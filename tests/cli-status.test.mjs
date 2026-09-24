import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCliStatus } from '../src/main/cli-status.ts'

test('parses Kimi rich status fields', () => {
  assert.deepEqual(parseCliStatus('Total: 405k | Cost: $0.46 | 5h: 3% | 7d: 34% | Model: kimi-code/k3/high/auto'), {
    source: 'kimi', model: 'kimi-code/k3/high/auto', context: undefined,
    fiveHour: '3%', weekly: '34%', total: '405k', cost: '$0.46'
  })
})

test('parses legacy Kimi model and context', () => {
  assert.deepEqual(parseCliStatus('agent (K3 ●)\ncontext: 13.2% (34.7k/262.1k)'), {
    source: 'kimi', model: 'K3', context: '13.2% (34.7k/262.1k)',
    fiveHour: undefined, weekly: undefined, total: undefined, cost: undefined
  })
})

test('parses Codex model, context, and weekly quota', () => {
  assert.deepEqual(parseCliStatus('gpt-5.6-sol low fast · ~/project · Context 0% used · weekly 0% left'), {
    source: 'codex', model: 'gpt-5.6-sol', context: '0% used', weekly: '0% left'
  })
})

test('returns null for ordinary shell output and empty screens', () => {
  assert.equal(parseCliStatus('hello from shell'), null)
  assert.equal(parseCliStatus(''), null)
})
