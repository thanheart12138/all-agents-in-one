import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { prepareDroppedFiles } from '../src/main/file-drop.ts'
import { formatDroppedPaths } from '../src/shared/file-drop.ts'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'aao-file-drop-'))
  const project = join(root, 'project')
  const external = join(root, 'external')
  await mkdir(project)
  await mkdir(external)
  return { root, project, external }
}

test('internal files use original paths without creating attachment directories', async () => {
  const { project } = await fixture()
  const file = join(project, '参考.txt')
  await writeFile(file, 'reference')
  const result = await prepareDroppedFiles(project, [file])
  assert.equal(result.copiedCount, 0)
  assert.equal(await readFile(result.paths[0], 'utf8'), 'reference')
  assert.deepEqual(await readdir(project), ['参考.txt'])
})

test('external files are copied by batch, preserve originals and do not collide', async () => {
  const { project, external } = await fixture()
  await writeFile(join(project, '.gitignore'), 'node_modules/')
  await mkdir(join(external, 'nested'))
  const first = join(external, '同名.txt')
  const second = join(external, 'nested', '同名.txt')
  await writeFile(first, 'first')
  await writeFile(second, 'second')
  const result = await prepareDroppedFiles(project, [first, second])
  assert.equal(result.copiedCount, 2)
  assert.notEqual(result.paths[0], result.paths[1])
  assert.ok(result.paths.every((path) => path.includes('/.aao/attachments/drop-')))
  assert.equal(await readFile(result.paths[0], 'utf8'), 'first')
  assert.equal(await readFile(result.paths[1], 'utf8'), 'second')
  const again = await prepareDroppedFiles(project, [first])
  assert.notEqual(again.paths[0], result.paths[0])
  await writeFile(result.paths[0], 'changed copy')
  assert.equal(await readFile(first, 'utf8'), 'first')
  assert.equal(await readFile(join(project, '.gitignore'), 'utf8'), 'node_modules/\n/.aao/attachments/\n')
  execFileSync('git', ['init', '-q', project])
  execFileSync('git', ['-C', project, 'check-ignore', '--', again.paths[0]])
})

test('mixed files and symlinks are classified by real location', async () => {
  const { project, external } = await fixture()
  const internal = join(project, 'inside.txt')
  const outside = join(external, 'outside.txt')
  await writeFile(internal, 'inside')
  await writeFile(outside, 'outside')
  await symlink(outside, join(project, 'linked.txt'))
  const result = await prepareDroppedFiles(project, [internal, join(project, 'linked.txt')])
  assert.equal(result.copiedCount, 1)
  assert.equal(await readFile(result.paths[1], 'utf8'), 'outside')
})

test('invalid paths, missing files and folders are rejected before copying', async () => {
  const { project, external } = await fixture()
  const valid = join(external, 'valid.txt')
  await writeFile(valid, 'valid')
  for (const input of [null, [], [42], ['relative.txt'], ['/tmp/a\nb'], ['/tmp/a\x1bb'], [valid, external], [valid, join(external, 'missing')]]) {
    await assert.rejects(prepareDroppedFiles(project, input))
  }
  assert.deepEqual(await readdir(project), [])
})

test('attachment and gitignore symlinks cannot redirect writes outside the project', async () => {
  for (const entry of ['.aao', '.aao/attachments', '.gitignore']) {
    const { project, external } = await fixture()
    const file = join(external, 'source.txt')
    await writeFile(file, 'unchanged')
    if (entry === '.aao/attachments') await mkdir(join(project, '.aao'))
    await symlink(entry === '.gitignore' ? file : external, join(project, entry))
    await assert.rejects(prepareDroppedFiles(project, [file]), /符号链接/)
    assert.deepEqual(await readdir(external), ['source.txt'])
    assert.equal(await readFile(file, 'utf8'), 'unchanged')
  }
})

test('paths containing spaces, quotes and shell syntax remain literal arguments', () => {
  const paths = ['/tmp/中文 file.txt', "/tmp/it's.txt", '/tmp/$(echo BAD);`echo BAD`.txt']
  const text = formatDroppedPaths(paths)
  assert.equal(/[\r\n]/.test(text), false)
  const output = execFileSync('/bin/sh', ['-c', `printf '%s\\0' ${text}`])
  assert.deepEqual(output.toString().split('\0').slice(0, -1), paths)
})
