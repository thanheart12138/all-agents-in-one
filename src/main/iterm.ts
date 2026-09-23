import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function isItermInstalled(): boolean {
  return existsSync('/Applications/iTerm.app') || existsSync(join(homedir(), 'Applications', 'iTerm.app'))
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function appleScriptQuote(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function openInIterm(file: string, args: string[]): Promise<void> {
  const command = [file, ...args].map(shellQuote).join(' ')
  const script = [
    'tell application "iTerm"',
    'activate',
    `create window with default profile command "${appleScriptQuote(command)}"`,
    'end tell'
  ].join('\n')
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || '无法打开 iTerm2 窗口'))
      else resolve()
    })
  })
}
