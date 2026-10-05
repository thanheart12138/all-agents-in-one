import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { bindTerminalSelection } from './terminal-selection'
import { containsClipboardImage, supportsImageClipboardPaste } from '../../shared/image-paste'
import { formatDroppedPaths } from '../../shared/file-drop'
import type { ItermTheme, TerminalStatus } from '../../shared/types'

const writers = new Map<string, (data: string) => void>()
const clearers = new Map<string, () => void>()
const focusers = new Map<string, () => void>()
const pendingData = new Map<string, string[]>()

export function writeTerminalData(terminalId: string, data: string): void {
  const writer = writers.get(terminalId)
  if (writer) {
    writer(data)
    return
  }
  const pending = pendingData.get(terminalId) ?? []
  pending.push(data)
  pendingData.set(terminalId, pending)
}

export function clearTerminalOutput(terminalId: string): void {
  pendingData.delete(terminalId)
  clearers.get(terminalId)?.()
}

export function focusTerminal(terminalId: string): void {
  focusers.get(terminalId)?.()
}

const defaultTheme = {
  background: '#11131f',
  foreground: '#dfe3f3',
  cursor: '#73a7ff',
  selectionBackground: '#40537c99',
  black: '#1a1d2b',
  red: '#ff6b81',
  green: '#67d391',
  yellow: '#f2c96d',
  blue: '#70a5ff',
  magenta: '#c792ea',
  cyan: '#62d6e8',
  white: '#dfe3f3'
}

/** 字体族：优先用 iTerm 配置的字体（PostScript 名/去后缀名都尝试），中文经 PingFang SC 回退 */
function buildFontFamily(iterm: ItermTheme | null): string {
  const fallbacks = 'Menlo, "PingFang SC", "Hiragino Sans GB", monospace'
  if (!iterm?.fontName) return `"SFMono-Regular", "Cascadia Code", ${fallbacks}`
  const bareName = iterm.fontName.replace(/-(Regular|Book|Medium|Bold|Italic|Light)$/, '')
  return `"${iterm.fontName}", "${bareName}", ${fallbacks}`
}

function buildTheme(iterm: ItermTheme | null): typeof defaultTheme & Record<string, string> {
  if (!iterm) return defaultTheme
  const theme: Record<string, string> = {
    background: iterm.background ?? defaultTheme.background,
    foreground: iterm.foreground ?? defaultTheme.foreground,
    cursor: iterm.cursor ?? defaultTheme.cursor,
    selectionBackground: iterm.selectionBackground ?? defaultTheme.selectionBackground
  }
  const ansi = iterm.ansi
  if (ansi && ansi.length === 16) {
    const keys = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']
    keys.forEach((key, index) => { theme[key] = ansi[index] })
  }
  return theme as typeof defaultTheme & Record<string, string>
}

interface TerminalViewProps {
  terminalId: string
  terminalName: string
  active: boolean
  status: TerminalStatus
  error?: string
  itermTheme: ItermTheme | null
  fontSize: number
  onZoom: (direction: 'in' | 'out') => void
}

export function TerminalView({ terminalId, terminalName, active, status, error, itermTheme, fontSize, onZoom }: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const activeRef = useRef(active)
  const terminalNameRef = useRef(terminalName)
  const onZoomRef = useRef(onZoom)
  const dropBusy = useRef(false)
  const [dropNotice, setDropNotice] = useState('')
  const [dropError, setDropError] = useState(false)
  activeRef.current = active
  terminalNameRef.current = terminalName
  onZoomRef.current = onZoom

  const importFiles = async (files: File[]): Promise<void> => {
    if (!activeRef.current || !files.length || dropBusy.current) return
    dropBusy.current = true
    setDropError(false)
    setDropNotice('正在准备文件…')
    const terminal = terminalRef.current
    try {
      const result = await window.terminalApi.prepareDroppedFiles(terminalId, files)
      if (!terminal || terminalRef.current !== terminal) return
      terminal.paste(formatDroppedPaths(result.paths))
      if (activeRef.current) terminal.focus()
      setDropNotice(result.copiedCount
        ? `已复制 ${result.copiedCount} 个文件到项目，路径已插入，尚未发送`
        : '文件路径已插入，尚未发送')
    } catch (error) {
      setDropError(true)
      setDropNotice(error instanceof Error ? error.message : '无法导入文件')
    } finally {
      dropBusy.current = false
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: buildFontFamily(itermTheme),
      fontSize,
      lineHeight: 1.35,
      scrollback: 10_000,
      allowTransparency: true,
      theme: buildTheme(itermTheme)
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    const disposeSelection = bindTerminalSelection(terminal)
    const handlePaste = (event: ClipboardEvent): void => {
      const clipboardData = event.clipboardData
      if (!activeRef.current || !clipboardData) return
      const files = Array.from(clipboardData.files)
      if (window.terminalApi.hasLocalFiles(files)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void importFiles(files)
        return
      }
      if (!supportsImageClipboardPaste(terminalNameRef.current)) return
      const formats = Array.from(clipboardData.types)
      const items = Array.from(clipboardData.items, (item) => ({ kind: item.kind, type: item.type }))
      if (!containsClipboardImage(formats, items)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      void window.terminalApi.pasteImage(terminalId)
    }
    containerRef.current.addEventListener('paste', handlePaste, true)
    let pinchDelta = 0
    const handlePinch = (event: WheelEvent): void => {
      if (!activeRef.current || !event.ctrlKey || event.metaKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      pinchDelta += event.deltaY
      if (Math.abs(pinchDelta) >= 20) {
        onZoomRef.current(pinchDelta < 0 ? 'in' : 'out')
        pinchDelta = 0
      }
    }
    containerRef.current.addEventListener('wheel', handlePinch, { capture: true, passive: false })
    // 给 IME 组合框样式提供跟随主题的 CSS 变量（见 styles.css .composition-view）
    const appliedTheme = buildTheme(itermTheme)
    containerRef.current.style.setProperty('--terminal-bg', appliedTheme.background)
    containerRef.current.style.setProperty('--terminal-fg', appliedTheme.foreground)
    terminal.onData((data) => window.terminalApi.write(terminalId, data))
    const handleFocus = (): void => window.terminalApi.setTerminalFocused(terminalId, true)
    const handleBlur = (): void => window.terminalApi.setTerminalFocused(terminalId, false)
    terminal.textarea?.addEventListener('focus', handleFocus)
    terminal.textarea?.addEventListener('blur', handleBlur)
    writers.set(terminalId, (data) => terminal.write(data))
    clearers.set(terminalId, () => terminal.clear())
    focusers.set(terminalId, () => terminal.focus())
    pendingData.get(terminalId)?.forEach((data) => terminal.write(data))
    pendingData.delete(terminalId)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const observer = new ResizeObserver(() => {
      if (containerRef.current?.offsetParent) {
        fitAddon.fit()
        window.terminalApi.resize(terminalId, terminal.cols, terminal.rows)
      }
    })
    observer.observe(containerRef.current)
    return () => {
      window.terminalApi.setTerminalFocused(terminalId, false)
      terminal.textarea?.removeEventListener('focus', handleFocus)
      terminal.textarea?.removeEventListener('blur', handleBlur)
      containerRef.current?.removeEventListener('paste', handlePaste, true)
      containerRef.current?.removeEventListener('wheel', handlePinch, true)
      observer.disconnect()
      disposeSelection()
      writers.delete(terminalId)
      clearers.delete(terminalId)
      focusers.delete(terminalId)
      terminal.dispose()
    }
  }, [terminalId])

  useLayoutEffect(() => {
    const terminal = terminalRef.current
    if (!terminal || terminal.options.fontSize === fontSize) return
    terminal.options.fontSize = fontSize
    if (!active) return
    fitAddonRef.current?.fit()
    window.terminalApi.resize(terminalId, terminal.cols, terminal.rows)
  }, [fontSize, active, terminalId])

  useEffect(() => {
    if (!active) return
    requestAnimationFrame(() => {
      fitAddonRef.current?.fit()
      terminalRef.current?.focus()
      const terminal = terminalRef.current
      if (terminal) window.terminalApi.resize(terminalId, terminal.cols, terminal.rows)
    })
  }, [active, terminalId])

  return (
    <div className={`terminal-view ${active ? 'active' : ''}`} ref={containerRef}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void importFiles(Array.from(event.dataTransfer.files))
      }}>
      {dropNotice && active && <div className={`drop-notice${dropError ? ' error' : ''}`} role="status">
        {dropNotice}<button onClick={() => setDropNotice('')} aria-label="关闭文件提示">×</button>
      </div>}
      {status === 'exited' && active && <div className="exit-banner">进程已退出，点击右上角“重启”重新打开</div>}
      {status === 'missing' && active && <div className="exit-banner">旧会话无法恢复，点击右上角“重启”进入持久会话</div>}
      {status === 'error' && active && <div className="exit-banner error">启动失败：{error ?? '请检查启动命令是否已安装'}</div>}
    </div>
  )
}
