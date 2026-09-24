import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { platform } from 'node:os'
import * as pty from 'node-pty'
import { hasMeaningfulTerminalOutput, isTerminalControlResponse, sanitizeTerminalInputChunk } from './input-parser'
import {
  capturePaneContent,
  hasTmuxSession,
  initializeTmux,
  isTmuxAvailable,
  killTmuxSession,
  makeTmuxSessionName,
  tmuxAttachCommand,
  tmuxConnection
} from './tmux'
import { isItermInstalled, openInIterm } from './iterm'
import { readItermTheme } from './iterm-theme'
import { readGitBranch } from './git'
import { parseCliStatus } from './cli-status'
import { moveProject, shouldMarkReadyForAttention } from './workspace-logic'
import { getCodexQuota, getKimiQuota, startQuotaPolling } from './quota'
import type {
  CliStatus,
  CreateTerminalInput,
  ProjectDefinition,
  TerminalDefinition,
  WorkspaceState
} from '../shared/types'

const sessions = new Map<string, pty.IPty>()
const inputBuffers = new Map<string, string>()
const activityTimers = new Map<string, NodeJS.Timeout>()
const cliStatuses = new Map<string, CliStatus>()
let cliStatusPoller: NodeJS.Timeout | null = null
let mainWindow: BrowserWindow | null = null
let workspace: WorkspaceState = { projects: [], activeTerminalId: null }

app.setName('All Agents in One')

function workspaceFile(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

function saveWorkspace(): void {
  const file = workspaceFile()
  mkdirSync(dirname(file), { recursive: true })
  const temporaryFile = `${file}.tmp`
  writeFileSync(temporaryFile, JSON.stringify(workspace, null, 2), 'utf8')
  renameSync(temporaryFile, file)
}

function loadWorkspace(): void {
  const file = workspaceFile()
  if (!existsSync(file)) return

  try {
    const saved = JSON.parse(readFileSync(file, 'utf8')) as WorkspaceState
    workspace = {
      projects: Array.isArray(saved.projects)
        ? saved.projects.map((project) => ({
            ...project,
            expanded: project.expanded ?? true,
            current: project.current === true,
            terminals: Array.isArray(project.terminals)
              ? project.terminals.map((terminal) => ({
                  ...terminal,
                  persistence: terminal.persistence ?? ('tmux' as const),
                  status: terminal.tmuxSessionName ? 'starting' as const : 'missing' as const,
                  lastUserMessage: terminal.lastUserMessage && !isTerminalControlResponse(terminal.lastUserMessage)
                    ? terminal.lastUserMessage
                    : undefined
                }))
              : []
          }))
        : [],
      activeTerminalId: saved.activeTerminalId ?? null
    }
    if (!workspace.projects.some((project) => project.terminals.some((terminal) => terminal.id === workspace.activeTerminalId))) {
      workspace.activeTerminalId = workspace.projects.flatMap((project) => project.terminals).at(0)?.id ?? null
    }
    saveWorkspace()
  } catch {
    workspace = { projects: [], activeTerminalId: null }
  }
}

function findTerminal(terminalId: string): { project: ProjectDefinition; terminal: TerminalDefinition } | null {
  for (const project of workspace.projects) {
    const terminal = project.terminals.find((item) => item.id === terminalId)
    if (terminal) return { project, terminal }
  }
  return null
}

function publishWorkspace(): void {
  mainWindow?.webContents.send('workspace:changed', workspace)
}

/** 刷新所有项目的 Git 分支（读 .git/HEAD，成本极低），有变化才落盘并通知渲染层 */
function refreshGitBranches(): void {
  let changed = false
  for (const project of workspace.projects) {
    const branch = readGitBranch(project.path) ?? undefined
    if (branch !== project.gitBranch) {
      project.gitBranch = branch
      changed = true
    }
  }
  if (changed) {
    saveWorkspace()
    publishWorkspace()
  }
}

function scheduleTerminalReady(terminal: TerminalDefinition): void {
  const existingTimer = activityTimers.get(terminal.id)
  if (existingTimer) clearTimeout(existingTimer)
  activityTimers.set(terminal.id, setTimeout(() => {
    if (sessions.has(terminal.id) && terminal.status === 'running') {
      terminal.status = 'ready'
      terminal.needsAttention = shouldMarkReadyForAttention(terminal.id, workspace.activeTerminalId, Boolean(mainWindow?.isFocused()))
      saveWorkspace()
      publishWorkspace()
    }
    activityTimers.delete(terminal.id)
  }, 2000))
}

function beginTerminalRun(terminal: TerminalDefinition): void {
  if (terminal.status === 'exited' || terminal.status === 'missing' || terminal.status === 'error' || terminal.status === 'detached') return
  if (terminal.status !== 'running') {
    terminal.status = 'running'
    terminal.needsAttention = false
    publishWorkspace()
  }
  scheduleTerminalReady(terminal)
}

function extendTerminalRun(terminal: TerminalDefinition, data: string): void {
  if (terminal.status === 'running' && hasMeaningfulTerminalOutput(data)) scheduleTerminalReady(terminal)
}

function captureTerminalInput(terminalId: string, data: string): void {
  const found = findTerminal(terminalId)
  if (!found) return

  const sanitizedData = sanitizeTerminalInputChunk(data)
  if (!sanitizedData) return

  let buffer = inputBuffers.get(terminalId) ?? ''
  for (const character of sanitizedData) {
    if (character === '\r' || character === '\n') {
      const input = buffer.trim().replace(/\s+/g, ' ')
      buffer = ''
      if (!input || isTerminalControlResponse(input)) continue

      if (/^Terminal \d+$/.test(found.terminal.name)) {
        const executable = input.match(/^(?:sudo\s+)?([^\s]+)/)?.[1]
        const name = executable?.split('/').filter(Boolean).at(-1)?.slice(0, 48)
        if (name && /^[\w.@+-]+$/.test(name)) found.terminal.name = name
      } else {
        found.terminal.lastUserMessage = input.slice(0, 160)
      }
      inputBuffers.delete(terminalId)
      saveWorkspace()
      publishWorkspace()
      continue
    }
    if (character === '' || character === '\b') buffer = buffer.slice(0, -1)
    else if (character === '' || character === '') buffer = ''
    else if (character >= ' ' && character !== '') buffer += character
  }
  inputBuffers.set(terminalId, buffer.slice(-1000))
}

function spawnTerminal(project: ProjectDefinition, terminal: TerminalDefinition, forceNew = false): void {
  sessions.get(terminal.id)?.kill()
  inputBuffers.delete(terminal.id)
  const existingTimer = activityTimers.get(terminal.id)
  if (existingTimer) clearTimeout(existingTimer)
  activityTimers.delete(terminal.id)

  const processEnvironment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  processEnvironment.TERM = 'xterm-256color'
  // GUI 启动（Finder/Dock）时进程环境里没有 locale 变量，tmux 会据此判定客户端不支持 UTF-8，
  // 把中文等非 ASCII 字符替换成下划线——这里显式补一个 UTF-8 locale
  if (!processEnvironment.LC_ALL && !processEnvironment.LC_CTYPE && !processEnvironment.LANG) {
    processEnvironment.LANG = `${app.getLocale().replace('-', '_') || 'en_US'}.UTF-8`
  }

  terminal.status = 'starting'
  if (forceNew) terminal.needsAttention = false
  delete terminal.exitCode
  delete terminal.error

  let session: pty.IPty
  try {
    if (!isTmuxAvailable()) throw new Error('未找到 tmux，无法创建持久会话')
    terminal.tmuxSessionName ??= makeTmuxSessionName(terminal.id)
    if (forceNew) killTmuxSession(terminal.tmuxSessionName)
    const connection = tmuxConnection(terminal.tmuxSessionName, project.path)
    session = pty.spawn(connection.file, connection.args, {
      name: 'xterm-256color',
      cols: 100,
      rows: 30,
      cwd: project.path,
      env: processEnvironment
    })
  } catch (error) {
    terminal.status = 'error'
    terminal.error = error instanceof Error ? error.message : '无法启动终端'
    saveWorkspace()
    return
  }

  terminal.status = 'ready'
  delete terminal.exitCode
  sessions.set(terminal.id, session)
  saveWorkspace()

  session.onData((data) => {
    extendTerminalRun(terminal, data)
    mainWindow?.webContents.send('terminal:data', { terminalId: terminal.id, data })
  })

  session.onExit(({ exitCode }) => {
    if (sessions.get(terminal.id) !== session) return
    sessions.delete(terminal.id)
    const activityTimer = activityTimers.get(terminal.id)
    if (activityTimer) clearTimeout(activityTimer)
    activityTimers.delete(terminal.id)
    terminal.status = 'exited'
    terminal.exitCode = exitCode
    saveWorkspace()
    mainWindow?.webContents.send('terminal:exit', { terminalId: terminal.id, exitCode })
  })
}

/** 每 3 秒抓取各终端可见屏幕，解析 CLI 状态（模型、用量），有变化才推送（只读抓取，不落盘） */
function pollCliStatuses(): void {
  let changed = false
  for (const project of workspace.projects) {
    for (const terminal of project.terminals) {
      const previous = cliStatuses.get(terminal.id)
      let next: CliStatus | null = null
      if (terminal.tmuxSessionName && sessions.has(terminal.id)) {
        const screen = capturePaneContent(terminal.tmuxSessionName)
        if (screen) next = parseCliStatus(screen)
      }
      // 5h/7d 额度走主进程直读（kimi 云端 /usages、codex 本地 session 文件），
      // 比屏幕抓取更可靠，且旧版 CLI 状态行没有这两个字段时也能显示
      if (next?.source) {
        const quota = next.source === 'kimi' ? getKimiQuota() : getCodexQuota()
        if (quota?.fiveHour) next.fiveHour = quota.fiveHour
        if (quota?.weekly) next.weekly = quota.weekly
      }
      if (JSON.stringify(previous ?? null) !== JSON.stringify(next)) {
        if (next) cliStatuses.set(terminal.id, next)
        else cliStatuses.delete(terminal.id)
        changed = true
      }
    }
  }
  if (changed) {
    mainWindow?.webContents.send('terminal:cli-status', Object.fromEntries(cliStatuses))
  }
}

function restoreTerminalSessions(): void {
  for (const project of workspace.projects) {
    for (const terminal of project.terminals) {
      if (!terminal.tmuxSessionName || !hasTmuxSession(terminal.tmuxSessionName)) {
        terminal.status = 'missing'
        continue
      }
      spawnTerminal(project, terminal)
    }
  }
  saveWorkspace()
  publishWorkspace()
}

function registerIpc(): void {
  ipcMain.handle('workspace:load', () => workspace)

  ipcMain.handle('terminal:theme', () => readItermTheme())

  ipcMain.handle('project:add', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择项目目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null

    const path = result.filePaths[0]
    if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error('所选项目目录不存在或无法访问')
    const existingProject = workspace.projects.find((project) => project.path === path)
    if (existingProject) return existingProject
    const project: ProjectDefinition = {
      id: randomUUID(),
      name: path.split(/[\\/]/).filter(Boolean).at(-1) ?? '新项目',
      path,
      expanded: true,
      current: true,
      gitBranch: readGitBranch(path) ?? undefined,
      terminals: []
    }
    workspace.projects.push(project)
    saveWorkspace()
    return project
  })

  ipcMain.handle('project:reveal', async (_event, projectId: string) => {
    const project = workspace.projects.find((item) => item.id === projectId)
    if (project) await shell.openPath(project.path)
  })

  ipcMain.handle('project:remove', (_event, projectId: string) => {
    const project = workspace.projects.find((item) => item.id === projectId)
    project?.terminals.forEach((terminal) => {
      sessions.get(terminal.id)?.kill()
      sessions.delete(terminal.id)
      inputBuffers.delete(terminal.id)
      const activityTimer = activityTimers.get(terminal.id)
      if (activityTimer) clearTimeout(activityTimer)
      activityTimers.delete(terminal.id)
      if (terminal.tmuxSessionName) killTmuxSession(terminal.tmuxSessionName)
    })
    workspace.projects = workspace.projects.filter((item) => item.id !== projectId)
    if (project?.terminals.some((terminal) => terminal.id === workspace.activeTerminalId)) {
      workspace.activeTerminalId = workspace.projects.flatMap((item) => item.terminals).at(0)?.id ?? null
    }
    saveWorkspace()
    return workspace
  })

  ipcMain.handle('project:rename', (_event, projectId: string, name: string) => {
    const project = workspace.projects.find((item) => item.id === projectId)
    if (project && name.trim()) project.name = name.trim()
    saveWorkspace()
    return workspace
  })

  ipcMain.handle('project:toggle', (_event, projectId: string) => {
    const project = workspace.projects.find((item) => item.id === projectId)
    if (project) project.expanded = !project.expanded
    saveWorkspace()
    return workspace
  })

  ipcMain.handle('project:move', (_event, projectId: string, current: boolean, beforeProjectId?: string) => {
    const projects = moveProject(workspace.projects, projectId, current, beforeProjectId)
    if (projects !== workspace.projects) {
      workspace.projects = projects
      saveWorkspace()
    }
    return workspace
  })

  ipcMain.handle('terminal:create', (_event, input: CreateTerminalInput) => {
    const project = workspace.projects.find((item) => item.id === input.projectId)
    if (!project) return workspace

    const terminal: TerminalDefinition = {
      id: randomUUID(),
      projectId: project.id,
      name: input.name?.trim() || `Terminal ${project.terminals.length + 1}`,
      command: input.command || process.env.SHELL || (platform() === 'win32' ? 'powershell.exe' : '/bin/zsh'),
      args: input.args ?? [],
      status: 'starting',
      persistence: 'tmux'
    }
    terminal.tmuxSessionName = makeTmuxSessionName(terminal.id)
    project.terminals.push(terminal)
    project.expanded = true
    workspace.activeTerminalId = terminal.id
    spawnTerminal(project, terminal)
    return workspace
  })

  ipcMain.handle('terminal:open', async (_event, terminalId: string) => {
    const found = findTerminal(terminalId)
    if (!found) return workspace
    if (!isItermInstalled()) throw new Error('未找到 iTerm2，请先从 iterm2.com 安装')
    if (!found.terminal.tmuxSessionName || !hasTmuxSession(found.terminal.tmuxSessionName)) {
      throw new Error('会话已丢失，请使用“重启”创建新会话')
    }
    const command = tmuxAttachCommand(found.terminal.tmuxSessionName)
    await openInIterm(command.file, command.args)
    return workspace
  })

  ipcMain.handle('terminal:rename', (_event, terminalId: string, name: string) => {
    const found = findTerminal(terminalId)
    if (found && name.trim()) {
      found.terminal.name = name.trim()
      inputBuffers.delete(terminalId)
    }
    saveWorkspace()
    return workspace
  })

  ipcMain.handle('terminal:close', (_event, terminalId: string) => {
    const found = findTerminal(terminalId)
    sessions.get(terminalId)?.kill()
    sessions.delete(terminalId)
    inputBuffers.delete(terminalId)
    cliStatuses.delete(terminalId)
    const activityTimer = activityTimers.get(terminalId)
    if (activityTimer) clearTimeout(activityTimer)
    activityTimers.delete(terminalId)
    if (found?.terminal.tmuxSessionName) killTmuxSession(found.terminal.tmuxSessionName)
    for (const project of workspace.projects) {
      project.terminals = project.terminals.filter((terminal) => terminal.id !== terminalId)
    }
    if (workspace.activeTerminalId === terminalId) {
      workspace.activeTerminalId = workspace.projects.flatMap((project) => project.terminals).at(0)?.id ?? null
    }
    saveWorkspace()
    return workspace
  })

  ipcMain.handle('terminal:restart', (_event, terminalId: string) => {
    const found = findTerminal(terminalId)
    if (found) spawnTerminal(found.project, found.terminal, true)
    return workspace
  })

  ipcMain.handle('terminal:activate', (_event, terminalId: string) => {
    workspace.activeTerminalId = terminalId
    const found = findTerminal(terminalId)
    if (found) found.terminal.needsAttention = false
    saveWorkspace()
    return workspace
  })

  ipcMain.on('terminal:write', (_event, terminalId: string, data: string) => {
    sessions.get(terminalId)?.write(data)
    const found = findTerminal(terminalId)
    if (found && (data.includes('\r') || data.includes('\n'))) beginTerminalRun(found.terminal)
    captureTerminalInput(terminalId, data)
  })

  ipcMain.on('terminal:resize', (_event, terminalId: string, cols: number, rows: number) => {
    if (cols > 0 && rows > 0) sessions.get(terminalId)?.resize(cols, rows)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 580,
    title: 'All Agents in One',
    backgroundColor: '#11131f',
    titleBarStyle: platform() === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 窗口重新获得焦点时刷新一次分支（用户可能在外部切换了分支）
  mainWindow.on('focus', () => {
    refreshGitBranches()
    const active = workspace.activeTerminalId ? findTerminal(workspace.activeTerminalId)?.terminal : null
    if (active?.needsAttention) {
      active.needsAttention = false
      saveWorkspace()
      publishWorkspace()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  mainWindow.webContents.once('did-finish-load', restoreTerminalSessions)
}

function sendCommand(command: string): void {
  mainWindow?.webContents.send('app:command', command)
}

function createApplicationMenu(): void {
  const modifier = platform() === 'darwin' ? 'Cmd' : 'Ctrl'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(platform() === 'darwin'
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),
    {
      label: '文件',
      submenu: [
        { label: '添加项目', accelerator: `${modifier}+Shift+O`, click: () => sendCommand('add-project') },
        { label: '新建终端', accelerator: `${modifier}+T`, click: () => sendCommand('new-terminal') },
        { type: 'separator' },
        { label: '关闭终端', accelerator: `${modifier}+W`, click: () => sendCommand('close-terminal') }
      ]
    },
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: '终端',
      submenu: [
        { label: '重启终端', accelerator: `${modifier}+Shift+R`, click: () => sendCommand('restart-terminal') },
        { label: '重命名终端', accelerator: 'F2', click: () => sendCommand('rename-terminal') }
      ]
    },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  initializeTmux(app.getPath('userData'))
  loadWorkspace()
  registerIpc()
  createApplicationMenu()
  createWindow()

  // 启动时解析一次分支，之后每 30 秒轮询（直接读文件，开销可忽略）
  refreshGitBranches()
  const gitBranchTimer = setInterval(refreshGitBranches, 30_000)
  gitBranchTimer.unref()

  // 每 3 秒抓取终端屏幕解析 CLI 状态（模型、用量）
  cliStatusPoller = setInterval(pollCliStatuses, 3000)
  cliStatusPoller.unref()

  // 额度直读轮询（kimi 云端 /usages 120s、codex 本地 session 文件 30s）
  startQuotaPolling()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  for (const timer of activityTimers.values()) clearTimeout(timer)
  activityTimers.clear()
  if (cliStatusPoller) clearInterval(cliStatusPoller)
  cliStatusPoller = null
  cliStatuses.clear()
  // 只断开与 tmux 的显示连接：状态记为“已分离”，不 kill tmux session，进程在后台继续运行
  for (const project of workspace.projects) {
    for (const terminal of project.terminals) {
      if (sessions.has(terminal.id)) terminal.status = 'detached'
    }
  }
  saveWorkspace()
  // 先从 map 移除再 kill，避免 onExit 回调把状态覆盖为 exited
  const activeSessions = [...sessions.values()]
  sessions.clear()
  for (const session of activeSessions) session.kill()
})
