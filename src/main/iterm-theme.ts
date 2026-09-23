import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 读取 iTerm2 默认 Profile 的外观配置（字体、字号、前景/背景/光标/选区色、16 个 ANSI 色），
 * 让内嵌终端与用户自己的 iTerm 保持一致观感。
 * 解析失败（未装 iTerm、plist 结构变化等）返回 null，由渲染层使用内置主题兜底。
 */

type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue }
type PlistDict = { [key: string]: PlistValue }

function decodeEntities(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function skipWhitespace(source: string, pos: { i: number }): void {
  while (pos.i < source.length && /\s/.test(source[pos.i])) pos.i++
}

function parseDict(source: string, pos: { i: number }): PlistDict {
  const result: PlistDict = {}
  pos.i += '<dict>'.length
  while (pos.i < source.length) {
    skipWhitespace(source, pos)
    if (source.startsWith('</dict>', pos.i)) {
      pos.i += '</dict>'.length
      return result
    }
    if (!source.startsWith('<key>', pos.i)) break
    pos.i += '<key>'.length
    const keyEnd = source.indexOf('</key>', pos.i)
    const key = decodeEntities(source.slice(pos.i, keyEnd))
    pos.i = keyEnd + '</key>'.length
    result[key] = parseValue(source, pos)
  }
  return result
}

function parseArray(source: string, pos: { i: number }): PlistValue[] {
  const result: PlistValue[] = []
  pos.i += '<array>'.length
  while (pos.i < source.length) {
    skipWhitespace(source, pos)
    if (source.startsWith('</array>', pos.i)) {
      pos.i += '</array>'.length
      return result
    }
    result.push(parseValue(source, pos))
  }
  return result
}

function parseValue(source: string, pos: { i: number }): PlistValue {
  skipWhitespace(source, pos)
  if (source.startsWith('<dict/>', pos.i)) { pos.i += '<dict/>'.length; return {} }
  if (source.startsWith('<array/>', pos.i)) { pos.i += '<array/>'.length; return [] }
  if (source.startsWith('<dict>', pos.i)) return parseDict(source, pos)
  if (source.startsWith('<array>', pos.i)) return parseArray(source, pos)
  if (source.startsWith('<true/>', pos.i)) { pos.i += '<true/>'.length; return true }
  if (source.startsWith('<false/>', pos.i)) { pos.i += '<false/>'.length; return false }
  const tagMatch = source.slice(pos.i, pos.i + 12).match(/^<(string|real|integer|data)>/)
  if (!tagMatch) throw new Error(`无法识别的 plist 节点，偏移 ${pos.i}`)
  const tag = tagMatch[1]
  pos.i += tagMatch[0].length
  const valueEnd = source.indexOf(`</${tag}>`, pos.i)
  const raw = source.slice(pos.i, valueEnd)
  pos.i = valueEnd + tag.length + 3
  if (tag === 'real' || tag === 'integer') return Number(raw.trim())
  return decodeEntities(raw)
}

function parsePlist(xml: string): PlistDict | null {
  const body = xml.match(/<plist[^>]*>([\s\S]*?)<\/plist>/)?.[1]
  if (!body) return null
  const pos = { i: 0 }
  skipWhitespace(body, pos)
  if (!body.startsWith('<dict>', pos.i)) return null
  return parseDict(body, pos)
}

function isDict(value: PlistValue | undefined): value is PlistDict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function componentToHex(color: PlistValue | undefined): string | undefined {
  if (!isDict(color)) return undefined
  const red = Number(color['Red Component'])
  const green = Number(color['Green Component'])
  const blue = Number(color['Blue Component'])
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return undefined
  const toHex = (channel: number): string => Math.round(Math.min(1, Math.max(0, channel)) * 255).toString(16).padStart(2, '0')
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

export interface ItermTheme {
  /** iTerm Normal Font 的原始字体名（PostScript 名，如 JetBrainsMonoNF-Regular） */
  fontName?: string
  fontSize?: number
  background?: string
  foreground?: string
  cursor?: string
  selectionBackground?: string
  /** 16 个 ANSI 颜色（0-7 常规，8-15 亮色） */
  ansi?: string[]
}

let cachedTheme: ItermTheme | null | undefined

export function readItermTheme(): ItermTheme | null {
  if (cachedTheme !== undefined) return cachedTheme
  cachedTheme = loadItermTheme()
  return cachedTheme
}

function loadItermTheme(): ItermTheme | null {
  try {
    const plistPath = join(homedir(), 'Library/Preferences/com.googlecode.iterm2.plist')
    if (!existsSync(plistPath)) return null
    const xml = execFileSync('plutil', ['-convert', 'xml1', '-o', '-', plistPath], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024
    })
    const root = parsePlist(xml)
    if (!root) return null
    const profiles = root['New Bookmarks']
    if (!Array.isArray(profiles) || profiles.length === 0) return null
    const defaultGuid = root['Default Bookmark Guid']
    const profile = profiles.find((item) => isDict(item) && item.Guid === defaultGuid) ?? profiles[0]
    if (!isDict(profile)) return null

    const theme: ItermTheme = {}
    if (typeof profile['Normal Font'] === 'string') {
      const fontMatch = profile['Normal Font'].match(/^(.+?)\s+(\d+(?:\.\d+)?)$/)
      if (fontMatch) {
        theme.fontName = fontMatch[1]
        theme.fontSize = Number(fontMatch[2])
      }
    }
    theme.background = componentToHex(profile['Background Color (Dark)'] ?? profile['Background Color'])
    theme.foreground = componentToHex(profile['Foreground Color (Dark)'] ?? profile['Foreground Color'])
    theme.cursor = componentToHex(profile['Cursor Color (Dark)'] ?? profile['Cursor Color'])
    theme.selectionBackground = componentToHex(profile['Selection Color (Dark)'] ?? profile['Selection Color'])

    const ansi: string[] = []
    for (let index = 0; index < 16; index++) {
      // iTerm 支持亮/暗两套配色，本应用为深色界面，优先取 (Dark) 变体
      const hex = componentToHex(profile[`Ansi ${index} Color (Dark)`] ?? profile[`Ansi ${index} Color`])
      if (!hex) break
      ansi.push(hex)
    }
    if (ansi.length === 16) theme.ansi = ansi

    return theme
  } catch {
    return null
  }
}
