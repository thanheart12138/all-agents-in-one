import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { ItermTheme, TerminalStatus } from '../../shared/types'

const writers = new Map<string, (data: string) => void>()
const clearers = new Map<string, () => void>()
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
  active: boolean
  status: TerminalStatus
  error?: string
  itermTheme: ItermTheme | null
}

export function TerminalView({ terminalId, active, status, error, itermTheme }: TerminalViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const terminalRef = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: buildFontFamily(itermTheme),
      fontSize: itermTheme?.fontSize ?? 14,
      lineHeight: 1.35,
      scrollback: 10_000,
      allowTransparency: true,
      theme: buildTheme(itermTheme)
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    // 给 IME 组合框样式提供跟随主题的 CSS 变量（见 styles.css .composition-view）
    const appliedTheme = buildTheme(itermTheme)
    containerRef.current.style.setProperty('--terminal-bg', appliedTheme.background)
    containerRef.current.style.setProperty('--terminal-fg', appliedTheme.foreground)
    terminal.onData((data) => window.terminalApi.write(terminalId, data))
    writers.set(terminalId, (data) => terminal.write(data))
    clearers.set(terminalId, () => terminal.clear())
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
      observer.disconnect()
      writers.delete(terminalId)
      clearers.delete(terminalId)
      terminal.dispose()
    }
  }, [terminalId])

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
    <div className={`terminal-view ${active ? 'active' : ''}`} ref={containerRef}>
      {status === 'exited' && active && <div className="exit-banner">进程已退出，点击右上角“重启”重新打开</div>}
      {status === 'missing' && active && <div className="exit-banner">旧会话无法恢复，点击右上角“重启”进入持久会话</div>}
      {status === 'error' && active && <div className="exit-banner error">启动失败：{error ?? '请检查启动命令是否已安装'}</div>}
    </div>
  )
}
