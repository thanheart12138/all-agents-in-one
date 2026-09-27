export interface ClipboardItemInfo {
  kind: string
  type: string
}

export function supportsImageClipboardPaste(terminalName: string): boolean {
  return /(^|[\s_-])(codex|kimi)(?=$|[\s._-])/i.test(terminalName)
}

export function containsClipboardImage(formats: readonly string[], items: readonly ClipboardItemInfo[]): boolean {
  return formats.some((format) => format.toLowerCase().startsWith('image/'))
    || items.some((item) => item.kind === 'file' && item.type.toLowerCase().startsWith('image/'))
}
