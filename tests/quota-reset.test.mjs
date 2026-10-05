import assert from 'node:assert/strict'
import test from 'node:test'
import { formatQuotaReset } from '../src/main/status-metrics.ts'

test('quota reset countdown handles days, minutes, expired and invalid timestamps', () => {
  const now = 1_000_000
  const reset = (minutes) => (now + minutes * 60_000) / 1000
  assert.equal(formatQuotaReset(reset(6 * 1440 + 23 * 60), now), ' (6d23h)')
  assert.equal(formatQuotaReset(reset(65), now), ' (1h5m)')
  assert.equal(formatQuotaReset(reset(0.1), now), ' (1m)')
  for (const value of [undefined, NaN, Infinity, reset(0), reset(-1)]) assert.equal(formatQuotaReset(value, now), '')
})
