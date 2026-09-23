import { execFileSync } from 'node:child_process'
import { delimiter, join } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'

const serverName = 'all-agents-in-one'
let executable: string | null = null
let configPath = ''

export function initializeTmux(userDataPath: string): void {
  const pathCandidates = [
    '/opt/homebrew/bin/tmux',
    '/usr/local/bin/tmux',
    ...(process.env.PATH ?? '').split(delimiter).map((directory) => join(directory, 'tmux'))
  ]
  executable = pathCandidates.find((candidate) => existsSync(candidate)) ?? null
  configPath = join(userDataPath, 'tmux.conf')
  writeFileSync(configPath, [
    'set -g status off',
    'set -g prefix None',
    'unbind-key C-b',
    // 滚轮向上进入 copy-mode 翻阅历史（history-limit 50000 行），解决长输出无法回看；
    // 鼠标拖选后直接复制进 macOS 剪贴板，保持本地选择的可用性
    'set -g mouse on',
    'bind -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"',
    'bind -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "pbcopy"',
    'set -g history-limit 50000',
    'set -g remain-on-exit on',
    'set -g window-size latest',
    'set -g default-terminal "tmux-256color"',
    'set -ga terminal-overrides ",xterm-256color:Tc"',
    ''
  ].join('\n'), 'utf8')
  // 已在运行的 server 立即加载新配置；server 不存在时忽略错误
  if (executable) {
    try {
      execFileSync(executable, [...baseArgs(), 'source-file', configPath], { stdio: 'ignore' })
    } catch { /* server 尚未启动 */ }
  }
}

export function isTmuxAvailable(): boolean {
  return executable !== null
}

export function makeTmuxSessionName(terminalId: string): string {
  return `aao-${terminalId.replaceAll('-', '').slice(0, 20)}`
}

function baseArgs(): string[] {
  return ['-L', serverName, '-f', configPath]
}

export function hasTmuxSession(sessionName: string): boolean {
  if (!executable) return false
  try {
    execFileSync(executable, [...baseArgs(), 'has-session', '-t', sessionName], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function killTmuxSession(sessionName: string): void {
  if (!executable || !hasTmuxSession(sessionName)) return
  execFileSync(executable, [...baseArgs(), 'kill-session', '-t', sessionName], { stdio: 'ignore' })
}

export function tmuxConnection(sessionName: string, cwd: string): { file: string; args: string[] } {
  if (!executable) throw new Error('未找到 tmux，请先安装 tmux')
  // -A：存在即接管，不存在则创建；不用 -D，避免踢掉 iTerm 等其他客户端
  return {
    file: executable,
    args: [...baseArgs(), 'new-session', '-A', '-s', sessionName, '-c', cwd]
  }
}

export function tmuxAttachCommand(sessionName: string): { file: string; args: string[] } {
  if (!executable) throw new Error('未找到 tmux，请先安装 tmux')
  return { file: executable, args: [...baseArgs(), 'attach-session', '-t', sessionName] }
}

/** 抓取会话当前可见屏幕的文本内容（渲染后的纯文本，不含转义序列）；会话不存在返回 null */
export function capturePaneContent(sessionName: string): string | null {
  if (!executable) return null
  try {
    return execFileSync(executable, [...baseArgs(), 'capture-pane', '-p', '-t', sessionName], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024
    })
  } catch {
    return null
  }
}
