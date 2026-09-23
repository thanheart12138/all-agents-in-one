const ESCAPE = '\u001b'
const BRACKETED_PASTE_START = `${ESCAPE}[200~`
const BRACKETED_PASTE_END = `${ESCAPE}[201~`

export function sanitizeTerminalInputChunk(data: string): string {
  if (data.includes(BRACKETED_PASTE_START)) {
    return data.replaceAll(BRACKETED_PASTE_START, '').replaceAll(BRACKETED_PASTE_END, '').replaceAll(ESCAPE, '')
  }
  if (data.includes(ESCAPE) || data.includes('\u009b')) return ''
  return data
}

export function isTerminalControlResponse(value: string): boolean {
  return /rgb:[0-9a-f/]+/i.test(value) || /^\[?\[\d+;\d+R/.test(value) || /\]\d+;(?:rgb:|rgba:)/i.test(value) || /\[\??\d+(?:;\d+)*[A-Za-z~]/.test(value) || /[\u001b\u009b]/.test(value)
}

export function hasMeaningfulTerminalOutput(data: string): boolean {
  const visibleText = data
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[@-_]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
  return visibleText.length > 0
}
