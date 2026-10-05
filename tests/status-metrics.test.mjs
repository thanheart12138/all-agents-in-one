import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGitChanges, parseNetworkBytes, parseUsedMemory, readGitChanges } from '../src/main/status-metrics.ts'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

test('Git changes count rename records, untracked paths, and skip binary numstat', () => {
  assert.equal(parseGitChanges('R  new\0old\0?? 中文\0 M file\0', '3\t2\tfile\n-\t-\tbinary'), '* +3 -2 ?1')
  assert.equal(parseGitChanges('', ''), ' +0 -0 ?0')
})

test('Git totals include staged and unstaged changes without double counting', async () => {
  const path = mkdtempSync(join(tmpdir(), 'aao-git-metrics-'))
  const git = (...args) => execFileSync('git', args, { cwd: path })
  git('init', '-q')
  writeFileSync(join(path, 'tracked'), 'one\ntwo\n')
  git('add', 'tracked')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'initial')
  writeFileSync(join(path, 'tracked'), 'one\ntwo\nthree\n')
  git('add', 'tracked')
  writeFileSync(join(path, 'tracked'), 'two\nthree\n')
  writeFileSync(join(path, 'new'), 'untracked')
  assert.equal(await readGitChanges(path), '* +1 -1 ?1')
  assert.equal(await readGitChanges(tmpdir()), undefined)
})

test('network counters count each non-loopback link once', () => {
  const output = 'en0 1500 <Link#1> address 10 0 1000 20 0 2000 0\nen0 1500 <Link#1> address 10 0 1000 20 0 2000 0\nlo0 16000 <Link#2> address 1 0 900 1 0 900 0\nen1 1500 192.168.1 address 10 0 1000 20 0 2000 0'
  assert.deepEqual(parseNetworkBytes(output), { received: 1000, sent: 2000 })
  assert.equal(parseNetworkBytes('permission denied'), undefined)
})

test('memory excludes free, inactive and speculative pages', () => {
  assert.equal(parseUsedMemory('page size of 16384 bytes\nPages free: 2.\nPages inactive: 3.\nPages speculative: 1.', 163840), 65536)
  assert.equal(parseUsedMemory('invalid', 163840), undefined)
})
