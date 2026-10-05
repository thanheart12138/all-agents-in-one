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
    source: 'kimi', model: 'K3/thinking:on', context: '13.2% (34.7k/262.1k)',
    fiveHour: undefined, weekly: undefined, total: undefined, cost: undefined
  })
})

test('parses Codex model, context, and weekly quota', () => {
  assert.deepEqual(parseCliStatus('gpt-5.6-sol low fast · ~/project · Context 0% used · weekly 0% left'), {
    source: 'codex', model: 'gpt-5.6-sol/low/fast', context: '0% used', weekly: '0% left'
  })
})

test('rich Model fields normalize settings to slashes and stop at status separators', () => {
  for (const separator of ['|', '·', '•', '\n']) {
    assert.equal(parseCliStatus(`Model: gpt-6.1-sol low fast ${separator} CPU: 13%`).model, 'gpt-6.1-sol/low/fast')
    const kimi = parseCliStatus(`Model: kimi-code/k3 high auto ${separator} ctx: 25%`)
    assert.equal(kimi.model, 'kimi-code/k3/high/auto')
    assert.equal(kimi.source, 'kimi')
  }
  assert.equal(parseCliStatus('Model: gpt-6.1-Sol low fast').model, 'gpt-6.1-Sol/low/fast', 'preserve original model casing')
})

test('Kimi native model preserves names and explicit thinking on or off', () => {
  assert.equal(parseCliStatus('agent (kimi-code/k3 ○) ~/project context: 25% (1k/4k)').model, 'kimi-code/k3/thinking:off')
  assert.equal(parseCliStatus('agent (Kimi K3 ●) ~/project').model, 'Kimi K3/thinking:on')
  assert.equal(parseCliStatus('agent (K3) ~/project').model, 'K3', 'missing indicator must not imply a thinking mode')
  assert.equal(parseCliStatus('agent ● ~/project context: 25% (1k/4k)').model, undefined, 'narrow CLI toolbar must not invent the hidden model')
  assert.equal(parseCliStatus('agent (K3 ●)\nagent (K3 ○)').model, 'K3/thinking:off', 'use the last visible model state')
})

test('Codex native model segment excludes paths and other fields', () => {
  assert.equal(parseCliStatus('gpt-6.1-sol high fast • ~/low-project • Context 25% used').model, 'gpt-6.1-sol/high/fast')
  assert.equal(parseCliStatus('gpt-6.1-sol   low   fast · ~/project · Context 25% used').model, 'gpt-6.1-sol/low/fast')
  assert.equal(parseCliStatus('gpt-6.1-sol · ~/fast-project · Context 25% used').model, 'gpt-6.1-sol')
})

test('returns null for ordinary shell output and empty screens', () => {
  assert.equal(parseCliStatus('hello from shell'), null)
  assert.equal(parseCliStatus(''), null)
})

test('Codex rich status preserves model settings and quota countdown', () => {
  const status = parseCliStatus('[video](main* +35 -28 ?24) • Total: 74.2M • 7d: 0% (6d23h) • Model: gpt-6.1-sol/high/on-request • CPU: 13%')
  assert.equal(status.source, 'codex')
  assert.equal(status.model, 'gpt-6.1-sol/high/on-request')
  assert.equal(status.total, '74.2M')
  assert.equal(status.weekly, '0% (6d23h)')
  assert.equal(parseCliStatus('Model: gpt-6.1-sol/high/on-request').source, 'codex')
  assert.equal(parseCliStatus('Total: 12k').source, undefined)
})
