import type { Terminal } from '@xterm/xterm'

/** Keep drag selections in xterm even when the CLI enables mouse reporting. */
export function bindTerminalSelection(terminal: Terminal): () => void {
  const screen = terminal.element?.querySelector<HTMLElement>('.xterm-screen')
  if (!screen) return () => {}
  let press: MouseEvent | null = null
  let dragging = false
  let replaying = false
  let start = 0
  let selection: { first: number; length: number; cols: number; buffer: Terminal['buffer']['active']; content: string } | null = null

  const selectedContent = (first: number, length: number): string => {
    const parts: string[] = []
    for (let offset = first; offset < first + length;) {
      const column = offset % terminal.cols
      const count = Math.min(terminal.cols - column, first + length - offset)
      const line = terminal.buffer.active.getLine(Math.floor(offset / terminal.cols))
      if (!line) return ''
      parts.push(`${line.isWrapped}:${line.translateToString(false, column, column + count)}`)
      offset += count
    }
    return JSON.stringify(parts)
  }
  const clear = (): void => {
    selection = null
    terminal.clearSelection()
  }
  // Re-enabling a CLI mouse protocol clears xterm's selection even without a text change.
  const parsed = terminal.onWriteParsed(() => {
    if (!selection) return
    const { first, length, cols, buffer, content } = selection
    if (terminal.cols !== cols || terminal.buffer.active !== buffer || selectedContent(first, length) !== content) {
      clear()
      return
    }
    if (!terminal.hasSelection()) terminal.select(first % cols, Math.floor(first / cols), length)
  })
  const input = terminal.onData(clear)
  const resize = terminal.onResize(clear)
  const scroll = terminal.onScroll(clear)

  const position = (event: MouseEvent): number => {
    const bounds = screen.getBoundingClientRect()
    const column = Math.max(0, Math.min(terminal.cols - 1,
      Math.floor((event.clientX - bounds.left) / (bounds.width / terminal.cols))))
    const row = Math.max(0, Math.min(terminal.rows - 1,
      Math.floor((event.clientY - bounds.top) / (bounds.height / terminal.rows))))
    return (terminal.buffer.active.viewportY + row) * terminal.cols + column
  }
  const consume = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const select = (event: MouseEvent): void => {
    const end = position(event)
    const first = Math.min(start, end)
    const length = Math.abs(end - start) + 1
    terminal.select(first % terminal.cols, Math.floor(first / terminal.cols), length)
    selection = { first, length, cols: terminal.cols, buffer: terminal.buffer.active, content: selectedContent(first, length) }
  }
  const down = (event: MouseEvent): void => {
    if (replaying || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    press = event
    dragging = false
    start = position(event)
    clear()
    terminal.focus()
    consume(event)
  }
  const move = (event: MouseEvent): void => {
    if (!press || replaying) return
    consume(event)
    if (Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) >= 3) dragging = true
    if (dragging) select(event)
  }
  const up = (event: MouseEvent): void => {
    if (!press || replaying || event.button !== 0) return
    const original = press
    press = null
    consume(event)
    if (Math.hypot(event.clientX - original.clientX, event.clientY - original.clientY) >= 3) dragging = true
    if (dragging) {
      select(event)
      terminal.focus()
      return
    }
    // Delay the press until we know it was a click; drags never reach the CLI.
    replaying = true
    try {
      for (const source of [original, event]) {
        screen.dispatchEvent(new MouseEvent(source.type, {
          bubbles: true, cancelable: true, view: window,
          button: source.button, buttons: source.buttons, detail: source.detail,
          clientX: source.clientX, clientY: source.clientY
        }))
      }
    } finally {
      replaying = false
    }
  }
  const cancel = (): void => { press = null }
  screen.addEventListener('mousedown', down, true)
  window.addEventListener('mousemove', move, true)
  window.addEventListener('mouseup', up, true)
  window.addEventListener('blur', cancel)
  return () => {
    parsed.dispose()
    input.dispose()
    resize.dispose()
    scroll.dispose()
    screen.removeEventListener('mousedown', down, true)
    window.removeEventListener('mousemove', move, true)
    window.removeEventListener('mouseup', up, true)
    window.removeEventListener('blur', cancel)
  }
}
