import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasMeaningfulTerminalOutput,
  isTerminalControlResponse,
  sanitizeTerminalInputChunk
} from '../src/main/input-parser.ts'

test('removes bracketed paste markers while preserving pasted text', () => {
  assert.equal(sanitizeTerminalInputChunk('\u001b[200~你好\u001b[201~'), '你好')
})

test('drops terminal escape responses but keeps ordinary input', () => {
  assert.equal(sanitizeTerminalInputChunk('\u001b[1;1R'), '')
  assert.equal(sanitizeTerminalInputChunk('echo 你好'), 'echo 你好')
})

test('recognizes terminal control responses and rejects user text', () => {
  assert.equal(isTerminalControlResponse('\u001b[1;1R'), true)
  assert.equal(isTerminalControlResponse('\u001b]10;rgb:ffff/ffff/ffff\u0007'), true)
  assert.equal(isTerminalControlResponse('帮我修复这个问题'), false)
})

test('counts visible output, including styled text, as meaningful', () => {
  assert.equal(hasMeaningfulTerminalOutput('\u001b[32m完成\u001b[0m'), true)
  assert.equal(hasMeaningfulTerminalOutput('\u001b[2J\u001b[H'), false)
  assert.equal(hasMeaningfulTerminalOutput('\u001b]0;terminal title\u0007'), false)
})
