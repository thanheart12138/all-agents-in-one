/** POSIX shell 单引号转义；通过 xterm.paste 插入，不附带换行。 */
export function formatDroppedPaths(paths: string[]): string {
  return paths.map((path) => `'${path.replaceAll("'", "'\\''")}'`).join(' ') + ' '
}
