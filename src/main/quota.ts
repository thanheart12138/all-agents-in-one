import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecureKimiQuotaUrl } from './security-utils'
import { parseKimiUsages } from './kimi-quota'

/**
 * CLI 账号额度直读（借鉴 token-tracker 的取数方式，不依赖终端屏幕内容）：
 * - Kimi Code：GET <base_url>/usages（OAuth access_token，同 CLI /usage 端点），
 *   凭证在 ~/.kimi/credentials/kimi-code.json（或 $KIMI_CODE_HOME / ~/.kimi-code），
 *   每 120s 后台刷新一次，缓存超 15 分钟视为失效不展示。
 * - Codex：扫 ~/.codex/sessions/ 最近 5 个 jsonl，取最后一条 token_count 事件里
 *   limit_id === "codex" 的 rate_limits（primary/secondary 按 window_minutes 分 5h/7d 桶），
 *   纯本地读文件，每 30s 刷新。
 * 所有失败都 fail-open（返回 null），状态栏对应分段自动隐藏。
 */

export interface Quota {
  /** 5 小时窗口已用百分比，如 "25%" */
  fiveHour?: string
  /** 7 天窗口已用百分比，如 "68%" */
  weekly?: string
  fiveHourResetsAt?: number
  weeklyResetsAt?: number
}

const KIMI_REFRESH_MS = 120_000
const KIMI_MAX_AGE_MS = 900_000
const KIMI_FETCH_TIMEOUT_MS = 8_000
const CODEX_REFRESH_MS = 30_000
const CODEX_SCAN_FILES = 5
const DEFAULT_KIMI_BASE_URL = 'https://api.kimi.com/coding/v1'

let kimiCache: { quota: Quota; fetchedAt: number } | null = null
let kimiRefreshing = false
let codexCache: { quota: Quota; fetchedAt: number } | null = null

// ---------- Kimi ----------

function kimiHome(): string | null {
  const candidates = [process.env.KIMI_CODE_HOME, join(homedir(), '.kimi'), join(homedir(), '.kimi-code')]
  for (const dir of candidates) {
    if (dir && existsSync(join(dir, 'credentials', 'kimi-code.json'))) return dir
  }
  return null
}

function kimiQuotaUrl(home: string): string {
  let base: string | undefined
  try {
    const toml = readFileSync(join(home, 'config.toml'), 'utf-8')
    const section = toml.match(/\[providers\."managed:kimi-code"\]([\s\S]*?)(?:\n\[|$)/)
    base = section?.[1]?.match(/base_url\s*=\s*"([^"]+)"/)?.[1]?.trim()
  } catch {
    // 读不到配置就用官方默认
  }
  return getSecureKimiQuotaUrl(base, DEFAULT_KIMI_BASE_URL)
}

function readKimiToken(home: string): string | null {
  try {
    const cred = JSON.parse(readFileSync(join(home, 'credentials', 'kimi-code.json'), 'utf-8'))
    // token 过期就放弃（CLI 日常使用会自行刷新写回），这里不做 refresh_token 流程
    if (typeof cred.access_token === 'string' && typeof cred.expires_at === 'number' && cred.expires_at > Date.now() / 1000) {
      return cred.access_token
    }
  } catch {
    // fail-open
  }
  return null
}

async function refreshKimiQuota(): Promise<void> {
  if (kimiRefreshing) return
  const home = kimiHome()
  const token = home ? readKimiToken(home) : null
  if (!home || !token) return
  kimiRefreshing = true
  try {
    const resp = await fetch(kimiQuotaUrl(home), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(KIMI_FETCH_TIMEOUT_MS)
    })
    const quota = parseKimiUsages(await resp.json())
    // 请求失败/解析失败不写缓存——旧缓存自然超龄后分段自动消失
    if (resp.ok && quota) kimiCache = { quota, fetchedAt: Date.now() }
  } catch {
    // 网络失败 fail-open
  } finally {
    kimiRefreshing = false
  }
}

// ---------- Codex ----------

function codexSessionsDir(): string | null {
  const home = process.env.CODEX_HOME ?? join(homedir(), '.codex')
  const dir = join(home, 'sessions')
  return existsSync(dir) ? dir : null
}

function listSessionFiles(dir: string): string[] {
  const files: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.jsonl')) files.push(path)
    }
  }
  walk(dir)
  return files
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, CODEX_SCAN_FILES)
    .map((entry) => entry.path)
}

/** 从单个 session 文件尾部往前找最后一条标准限额快照（limit_id === "codex"，Spark 等独立池不算） */
function readCodexRateLimits(path: string): { fiveHour?: number; weekly?: number; fiveHourResetsAt?: number; weeklyResetsAt?: number } | null {
  const lines = readFileSync(path, 'utf-8').split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.includes('rate_limits')) continue
    try {
      const payload = (JSON.parse(line) as Record<string, unknown>).payload as Record<string, unknown> | undefined
      if (payload?.type !== 'token_count') continue
      const rl = payload.rate_limits as Record<string, unknown> | undefined
      if (!rl || rl.limit_id !== 'codex') continue
      let fiveHour: number | undefined
      let weekly: number | undefined
      let fiveHourResetsAt: number | undefined
      let weeklyResetsAt: number | undefined
      for (const key of ['primary', 'secondary'] as const) {
        const bucket = rl[key] as Record<string, unknown> | null | undefined
        if (!bucket || typeof bucket.used_percent !== 'number') continue
        // 按 window_minutes 分桶，而不是固定 primary→5h（free plan 实测 primary 是 7 天窗口）
        const reset = typeof bucket.resets_at === 'number' ? bucket.resets_at : undefined
        if ((Number(bucket.window_minutes) || 0) < 1440) {
          fiveHour = bucket.used_percent
          fiveHourResetsAt = reset
        } else {
          weekly = bucket.used_percent
          weeklyResetsAt = reset
        }
      }
      if (fiveHour !== undefined || weekly !== undefined) return { fiveHour, weekly, fiveHourResetsAt, weeklyResetsAt }
    } catch {
      // 单行解析失败继续往前找
    }
  }
  return null
}

function refreshCodexQuota(): void {
  try {
    const dir = codexSessionsDir()
    if (!dir) return
    for (const file of listSessionFiles(dir)) {
      const limits = readCodexRateLimits(file)
      if (!limits) continue
      codexCache = {
        fetchedAt: Date.now(),
        quota: {
          fiveHour: limits.fiveHour === undefined ? undefined : `${Math.round(limits.fiveHour)}%`,
          weekly: limits.weekly === undefined ? undefined : `${Math.round(limits.weekly)}%`,
          fiveHourResetsAt: limits.fiveHourResetsAt,
          weeklyResetsAt: limits.weeklyResetsAt
        }
      }
      return
    }
  } catch {
    // fail-open
  }
}

// ---------- 对外 ----------

/** 启动额度轮询（kimi 云端 120s / codex 本地 30s），应用启动时调用一次 */
export function startQuotaPolling(): void {
  void refreshKimiQuota()
  refreshCodexQuota()
  const timer = setInterval(() => {
    if (!kimiCache || Date.now() - kimiCache.fetchedAt >= KIMI_REFRESH_MS) void refreshKimiQuota()
    if (!codexCache || Date.now() - codexCache.fetchedAt >= CODEX_REFRESH_MS) refreshCodexQuota()
  }, CODEX_REFRESH_MS)
  timer.unref()
}

export function getKimiQuota(): Quota | null {
  if (!kimiCache || Date.now() - kimiCache.fetchedAt >= KIMI_MAX_AGE_MS) return null
  return kimiCache.quota
}

export function getCodexQuota(): Quota | null {
  return codexCache?.quota ?? null
}
