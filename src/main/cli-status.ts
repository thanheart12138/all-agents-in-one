import type { CliStatus } from '../shared/types'

/**
 * 从终端可见屏幕文本中尽力提取 CLI 状态（模型名、上下文/额度用量）。
 * 仅做只读的屏幕抓取（tmux capture-pane），不写入、不干扰 CLI 协议；
 * 识别不出时返回 null，状态栏对应分段自动隐藏。
 *
 * 目前支持：
 * - Kimi Code 新版状态行："... | Total: 405k | Cost: $0.46 | 5h: 3% | 7d: 34% | Model: kimi-code/k3/high/auto | Ready"
 * - Kimi Code 旧版：状态行 "agent (K3 ●) ..."，右下角 "context: 13.2% (34.7k/262.1k)"
 * - Codex：状态行 "gpt-5.6-sol low fast · ~/path · Context 0% used · weekly 0% left"
 */

function lastMatch(text: string, pattern: RegExp): RegExpMatchArray | null {
  return [...text.matchAll(pattern)].at(-1) ?? null
}

export function parseCliStatus(screen: string): CliStatus | null {
  // Kimi Code 新版富状态行（tt / 官方 status_line）：
  // "[design-agent](main) | Total: 405k | Cost: $0.46 | 5h: 3% | 7d: 34% | Model: kimi-code/k3/high/auto | Ready"
  const richTotal = lastMatch(screen, /\bTotal:\s*([\d.]+\w*)/gi)
  const richCost = lastMatch(screen, /\bCost:\s*(\$[\d.]+)/gi)
  const richFive = lastMatch(screen, /\b5h:\s*(\d+(?:\.\d+)?%(?:\s*\([\d dhms]+\))?)/gi)
  const richWeekly = lastMatch(screen, /\b7d:\s*(\d+(?:\.\d+)?%(?:\s*\([\d dhms]+\))?)/gi)
  const richModel = lastMatch(screen, /\bModel:[ \t]*([^|·•\r\n]+)/gi)
  const richModelText = richModel?.[1].trim().replace(/[ \t]+/g, '/')

  // Kimi Code 旧版：状态行 "agent (K3 ●) ..."，右下角 "context: 13.2% (34.7k/262.1k)"
  const kimiContext = lastMatch(screen, /context:\s*(\d+(?:\.\d+)?%\s*\([^)]+\))/gi)
  const kimiModel = lastMatch(screen, /\bagent[ \t]+\(([^()\r\n]+)\)/g)
  const kimiThinking = kimiModel?.[1].match(/[ \t]+([●○])[ \t]*$/)?.[1]
  const kimiModelText = kimiModel?.[1].replace(/[ \t]+[●○][ \t]*$/, '').trim().replace(/[ \t]+/g, ' ')

  if (richModel || richTotal || richCost || richFive || richWeekly || kimiContext || kimiModel) {
    return {
      source: richModelText?.startsWith('gpt-') || richModelText?.startsWith('codex') ? 'codex' : kimiModel || richModelText?.match(/^(kimi|K\d)/i) ? 'kimi' : undefined,
      model: richModelText || (kimiModelText ? `${kimiModelText}${kimiThinking ? `/thinking:${kimiThinking === '●' ? 'on' : 'off'}` : ''}` : undefined),
      context: kimiContext?.[1],
      fiveHour: richFive?.[1],
      weekly: richWeekly?.[1],
      total: richTotal?.[1],
      cost: richCost?.[1]
    }
  }

  // Codex
  const codexLine = screen.split('\n').reverse().find((line) => /Context\s+\d+%\s+used/i.test(line))
  if (codexLine) {
    const model = codexLine.split(/[·•|]/)[0]?.trim().replace(/[ \t]+/g, ' ')
    const context = codexLine.match(/Context\s+(\d+%)\s+used/i)?.[1]
    const weekly = codexLine.match(/weekly\s+(\d+%)\s+left/i)?.[1]
    return {
      source: 'codex',
      model: model && /^[\w.-]{2,80}(?: [\w.-]+)*$/.test(model) ? model.replace(/ /g, '/') : undefined,
      context: context ? `${context} used` : undefined,
      weekly: weekly ? `${weekly} left` : undefined
    }
  }

  return null
}
