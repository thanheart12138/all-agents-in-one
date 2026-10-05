import type { Quota } from './quota'

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** 与 Kimi CLI /usage 的 _reset_hint 一致，统一转成 Unix 秒，缓存期间仍可倒计时。 */
function resetTime(detail: unknown, now: number): number | undefined {
  const data = record(detail)
  if (!data) return undefined
  for (const key of ['reset_at', 'resetAt', 'reset_time', 'resetTime']) {
    const value = data[key]
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) continue
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) return timestamp / 1000
  }
  for (const key of ['reset_in', 'resetIn', 'ttl', 'window']) {
    const value = data[key]
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) continue
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds > 0) return now / 1000 + seconds
  }
  return undefined
}

function pctOf(detail: unknown): number | null {
  const data = record(detail)
  if (!data) return null
  const limit = Number(data.limit)
  const used = Number(data.used)
  return limit > 0 && Number.isFinite(used) ? used / limit * 100 : null
}

export function parseKimiUsages(data: unknown, now = Date.now()): Quota | null {
  const root = record(data)
  if (!root) return null
  const usages = record(root.usages)
  const fiveDetail = record(usages?.limit_5h)
  const sevenDetail = record(usages?.limit_7d)
  let five = typeof fiveDetail?.used_ratio === 'number' && Number.isFinite(fiveDetail.used_ratio) ? fiveDetail.used_ratio * 100 : null
  let seven = typeof sevenDetail?.used_ratio === 'number' && Number.isFinite(sevenDetail.used_ratio) ? sevenDetail.used_ratio * 100 : null
  let fiveHourResetsAt = resetTime(fiveDetail, now)
  let weeklyResetsAt = resetTime(sevenDetail, now)

  // 官方 /usage 格式：limits[].detail 为 5h，usage 为周额度。
  if (Array.isArray(root.limits)) {
    for (const item of root.limits) {
      const entry = record(item)
      const window = record(entry?.window)
      if (window?.duration === 300 && window.timeUnit === 'TIME_UNIT_MINUTE') {
        five ??= pctOf(entry?.detail)
        fiveHourResetsAt ??= resetTime(entry?.detail, now)
        break
      }
    }
  }
  seven ??= pctOf(root.usage)
  weeklyResetsAt ??= resetTime(root.usage, now)

  if (five === null && seven === null) return null
  return {
    fiveHour: five === null ? undefined : `${Math.round(five)}%`,
    weekly: seven === null ? undefined : `${Math.round(seven)}%`,
    fiveHourResetsAt: five === null ? undefined : fiveHourResetsAt,
    weeklyResetsAt: seven === null ? undefined : weeklyResetsAt
  }
}
