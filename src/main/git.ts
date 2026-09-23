import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * 直接读取 .git/HEAD 解析分支名，避免 spawn git 子进程
 * （在未安装 Xcode CLT 的 macOS 上执行 git 会弹出安装对话框）。
 * 支持普通仓库与 worktree（.git 为 "gitdir: ..." 指针文件）；
 * detached HEAD 时返回短 SHA；非 Git 目录返回 null。
 */
export function readGitBranch(projectPath: string): string | null {
  try {
    const gitEntry = join(projectPath, '.git')
    if (!existsSync(gitEntry)) return null

    let headFile: string
    if (statSync(gitEntry).isDirectory()) {
      headFile = join(gitEntry, 'HEAD')
    } else {
      const pointer = readFileSync(gitEntry, 'utf8').match(/^gitdir:\s*(.+)$/m)
      if (!pointer) return null
      headFile = join(resolve(projectPath, pointer[1].trim()), 'HEAD')
    }

    if (!existsSync(headFile)) return null
    const head = readFileSync(headFile, 'utf8').trim()
    const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/)
    if (ref) return ref[1]
    // detached HEAD：HEAD 内容为完整 SHA，取前 7 位
    return head.length >= 7 ? head.slice(0, 7) : null
  } catch {
    return null
  }
}
