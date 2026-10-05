import { execFile } from 'node:child_process'
import { cpus, totalmem } from 'node:os'
import { promisify } from 'node:util'

const execute = promisify(execFile)

export function formatQuotaReset(resetsAt: number | undefined, now = Date.now()): string {
  if (!resetsAt || !Number.isFinite(resetsAt) || resetsAt * 1000 <= now) return ''
  const minutes = Math.ceil((resetsAt * 1000 - now) / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes % 1440 / 60)
  return ` (${days ? `${days}d` : ''}${hours ? `${hours}h` : ''}${days ? '' : `${minutes % 60}m`})`
}

export function parseGitChanges(status: string, diff: string): string {
  const entries = status.split('\0').filter(Boolean)
  let untracked = 0
  let dirty = false
  for (let i = 0; i < entries.length; i++) {
    const code = entries[i].slice(0, 2)
    dirty = true
    if (code === '??') untracked++
    if (/[RC]/.test(code)) i++
  }
  let added = 0
  let removed = 0
  for (const line of diff.split('\n')) {
    const [a, r] = line.split('\t')
    if (/^\d+$/.test(a) && /^\d+$/.test(r)) {
      added += Number(a)
      removed += Number(r)
    }
  }
  return `${dirty ? '*' : ''} +${added} -${removed} ?${untracked}`
}

export async function readGitChanges(path: string): Promise<string | undefined> {
  try {
    const options = { cwd: path, timeout: 4000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }
    const [status, diff] = await Promise.all([
      execute('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], options),
      execute('git', ['diff', '--no-ext-diff', '--no-textconv', '--numstat', 'HEAD', '--'], options)
    ])
    return parseGitChanges(status.stdout, diff.stdout)
  } catch {
    return undefined
  }
}

export function parseNetworkBytes(output: string): { received: number; sent: number } | undefined {
  const seen = new Set<string>()
  let received = 0
  let sent = 0
  for (const line of output.split('\n')) {
    const columns = line.trim().split(/\s+/)
    if (!columns[2]?.startsWith('<Link#') || columns[0].startsWith('lo') || seen.has(columns[0])) continue
    const input = Number(columns[6])
    const out = Number(columns[9])
    if (!Number.isFinite(input) || !Number.isFinite(out)) continue
    seen.add(columns[0])
    received += input
    sent += out
  }
  return seen.size ? { received, sent } : undefined
}

export function parseUsedMemory(output: string, total: number): number | undefined {
  const pageSize = Number(output.match(/page size of (\d+) bytes/)?.[1])
  const pages = (name: string): number => Number(output.match(new RegExp(`Pages ${name}:\\s+(\\d+)`))?.[1])
  const free = pages('free') + pages('inactive') + pages('speculative')
  return pageSize && Number.isFinite(free) ? Math.max(0, total - free * pageSize) : undefined
}

function cpuTimes(): { idle: number; total: number } {
  return cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle, total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 })
}

let previousCpu = cpuTimes()
let previousNetwork: { received: number; sent: number; time: number } | undefined

export async function readSystemMetrics(): Promise<{ cpu?: string; memory?: string; upload?: string; download?: string }> {
  const currentCpu = cpuTimes()
  const elapsedCpu = currentCpu.total - previousCpu.total
  const cpu = elapsedCpu > 0 ? `${Math.round(100 * (1 - (currentCpu.idle - previousCpu.idle) / elapsedCpu))}%` : undefined
  previousCpu = currentCpu
  const [memory, network] = await Promise.allSettled([
    execute('/usr/bin/vm_stat', [], { timeout: 2000 }),
    execute('/usr/sbin/netstat', ['-ibn'], { timeout: 2000 })
  ])
  const used = memory.status === 'fulfilled' ? parseUsedMemory(memory.value.stdout, totalmem()) : undefined
  const bytes = network.status === 'fulfilled' ? parseNetworkBytes(network.value.stdout) : undefined
  const time = performance.now()
  let upload: string | undefined
  let download: string | undefined
  if (bytes && previousNetwork && time > previousNetwork.time && bytes.sent >= previousNetwork.sent && bytes.received >= previousNetwork.received) {
    const seconds = (time - previousNetwork.time) / 1000
    upload = `${((bytes.sent - previousNetwork.sent) / seconds / 1e6).toFixed(1)} MB/s`
    download = `${((bytes.received - previousNetwork.received) / seconds / 1e6).toFixed(1)} MB/s`
  }
  previousNetwork = bytes ? { ...bytes, time } : undefined
  return { cpu, memory: used === undefined ? undefined : `${(used / 1e9).toFixed(1)} GB`, upload, download }
}
