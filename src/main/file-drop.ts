import { constants } from 'node:fs'
import { appendFile, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'

function isInside(root: string, path: string): boolean {
  const child = relative(root, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

async function ensureAttachmentDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
  const info = await lstat(path)
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('附件目录不能是符号链接或普通文件')
}

async function ignoreAttachments(root: string): Promise<void> {
  const path = join(root, '.gitignore')
  let contents = ''
  try {
    if (!(await lstat(path)).isFile()) throw new Error('.gitignore 必须是普通文件，不能是符号链接')
    contents = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const rule = '/.aao/attachments/'
  if (!contents.split(/\r?\n/).includes(rule)) {
    await appendFile(path, `${contents && !contents.endsWith('\n') ? '\n' : ''}${rule}\n`)
  }
}

export async function prepareDroppedFiles(projectPath: string, input: unknown): Promise<{ paths: string[]; copiedCount: number }> {
  if (!Array.isArray(input) || input.length === 0 || input.some((path) =>
    typeof path !== 'string' || !isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path))) {
    throw new Error('请拖入本地文件，路径不能包含换行或控制字符')
  }
  const root = await realpath(projectPath)
  const files = await Promise.all(input.map(async (path: string) => {
    const resolved = await realpath(path)
    if (/[\x00-\x1f\x7f]/.test(resolved)) throw new Error('文件路径不能包含换行或控制字符')
    if (!(await stat(resolved)).isFile()) throw new Error('暂不支持拖入文件夹，请选择文件')
    return { path: resolved, name: basename(path), external: !isInside(root, resolved) }
  }))
  const copiedCount = files.filter((file) => file.external).length
  let batch = ''
  if (copiedCount) {
    await ensureAttachmentDirectory(join(root, '.aao'))
    const attachments = join(root, '.aao', 'attachments')
    await ensureAttachmentDirectory(attachments)
    await ignoreAttachments(root)
    batch = await mkdtemp(join(attachments, 'drop-'))
  }
  const paths: string[] = []
  for (const [index, file] of files.entries()) {
    if (!file.external) {
      paths.push(file.path)
      continue
    }
    const destination = join(batch, `${index + 1}-${file.name}`)
    await copyFile(file.path, destination, constants.COPYFILE_EXCL)
    paths.push(destination)
  }
  return { paths, copiedCount }
}
