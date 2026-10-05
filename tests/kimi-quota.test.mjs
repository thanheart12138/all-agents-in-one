import assert from 'node:assert/strict'
import test from 'node:test'
import { parseKimiUsages } from '../src/main/kimi-quota.ts'
import { formatQuotaReset } from '../src/main/status-metrics.ts'

const now = Date.parse('2026-10-05T00:00:00Z')
const fiveReset = '2026-10-05T02:05:00.443553353Z'
const sevenReset = '2026-10-11T23:00:00Z'
const fiveWindow = { duration: 300, timeUnit: 'TIME_UNIT_MINUTE' }

test('Kimi official usage format parses both reset timestamps independently', () => {
  const quota = parseKimiUsages({
    usage: { limit: 100, used: 68, resetTime: sevenReset },
    limits: [
      { window: { duration: 60, timeUnit: 'TIME_UNIT_MINUTE' }, detail: { limit: 100, used: 99, resetTime: sevenReset } },
      { window: fiveWindow, detail: { limit: 100, used: 25, resetTime: fiveReset } }
    ]
  }, now)
  assert.equal(quota.fiveHour, '25%')
  assert.equal(quota.weekly, '68%')
  assert.equal(quota.fiveHourResetsAt, Date.parse(fiveReset) / 1000)
  assert.equal(quota.weeklyResetsAt, Date.parse(sevenReset) / 1000)
  assert.equal(formatQuotaReset(quota.fiveHourResetsAt, now), ' (2h6m)')
  assert.equal(formatQuotaReset(quota.weeklyResetsAt, now), ' (6d23h)')
  assert.equal(formatQuotaReset(quota.fiveHourResetsAt, now + 120_000), ' (2h4m)', 'cached quota must continue counting down')
})

test('Kimi ratio format preserves percentages and reads official reset aliases', () => {
  for (const key of ['reset_at', 'resetAt', 'reset_time', 'resetTime']) {
    const quota = parseKimiUsages({ usages: {
      limit_5h: { used_ratio: 0.25, [key]: fiveReset },
      limit_7d: { used_ratio: 0, [key]: sevenReset }
    } }, now)
    assert.equal(quota.fiveHour, '25%')
    assert.equal(quota.weekly, '0%')
    assert.equal(quota.fiveHourResetsAt, Date.parse(fiveReset) / 1000)
    assert.equal(quota.weeklyResetsAt, Date.parse(sevenReset) / 1000)
  }
})

test('Kimi relative reset seconds become fixed timestamps at fetch time', () => {
  for (const key of ['reset_in', 'resetIn', 'ttl', 'window']) {
    const quota = parseKimiUsages({ usages: {
      limit_5h: { used_ratio: 0.25, [key]: '3600' },
      limit_7d: { used_ratio: 0.68, [key]: 604800 }
    } }, now)
    assert.equal(quota.fiveHourResetsAt, now / 1000 + 3600)
    assert.equal(quota.weeklyResetsAt, now / 1000 + 604800)
    assert.equal(formatQuotaReset(quota.fiveHourResetsAt, now + 60_000), ' (59m)')
  }
})

test('missing, malformed or expired reset times do not break quota percentages', () => {
  for (const value of [undefined, null, '', 'not-a-date', 123]) {
    const quota = parseKimiUsages({ usages: { limit_5h: { used_ratio: 0.25, resetTime: value } } }, now)
    assert.equal(quota.fiveHour, '25%')
    assert.equal(quota.fiveHourResetsAt, undefined)
    assert.equal(quota.weekly, undefined)
  }
  const expired = parseKimiUsages({ usage: { limit: 100, used: 68, resetTime: '2026-10-04T00:00:00Z' } }, now)
  assert.equal(expired.weekly, '68%')
  assert.equal(formatQuotaReset(expired.weeklyResetsAt, now), '')
  for (const value of [null, [], {}, { limits: [null] }, { usages: { limit_5h: { used_ratio: NaN } } }]) assert.equal(parseKimiUsages(value, now), null)
})

test('ratio response can use legacy reset fields without changing ratio percentages', () => {
  const quota = parseKimiUsages({
    usages: { limit_5h: { used_ratio: 0.25 }, limit_7d: { used_ratio: 0.68 } },
    limits: [{ window: fiveWindow, detail: { limit: 100, used: 50, resetTime: fiveReset } }],
    usage: { limit: 100, used: 99, resetTime: sevenReset }
  }, now)
  assert.equal(quota.fiveHour, '25%')
  assert.equal(quota.weekly, '68%')
  assert.equal(quota.fiveHourResetsAt, Date.parse(fiveReset) / 1000)
  assert.equal(quota.weeklyResetsAt, Date.parse(sevenReset) / 1000)
})
