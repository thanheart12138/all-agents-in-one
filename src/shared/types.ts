export type TerminalStatus = 'starting' | 'ready' | 'running' | 'detached' | 'exited' | 'missing' | 'error'

export interface TerminalDefinition {
  id: string
  projectId: string
  name: string
  command: string
  args: string[]
  status: TerminalStatus
  exitCode?: number
  error?: string
  lastUserMessage?: string
  tmuxSessionName?: string
  persistence?: 'tmux'
}

export interface ProjectDefinition {
  id: string
  name: string
  path: string
  expanded: boolean
  /** 当前 Git 分支名（detached HEAD 时为短 SHA），非 Git 目录为空 */
  gitBranch?: string
  terminals: TerminalDefinition[]
}

export interface WorkspaceState {
  projects: ProjectDefinition[]
  activeTerminalId: string | null
}

export interface CreateTerminalInput {
  projectId: string
  name?: string
  command?: string
  args?: string[]
}

export interface TerminalDataEvent {
  terminalId: string
  data: string
}

export interface TerminalExitEvent {
  terminalId: string
  exitCode: number
}

export type AppCommand = 'add-project' | 'new-terminal' | 'close-terminal' | 'restart-terminal' | 'rename-terminal'

/** 从 iTerm2 默认 Profile 读取的终端外观（暗色变体优先），用于让内嵌终端与用户的 iTerm 观感一致 */
export interface ItermTheme {
  fontName?: string
  fontSize?: number
  background?: string
  foreground?: string
  cursor?: string
  selectionBackground?: string
  ansi?: string[]
}

/** CLI 状态（模型、上下文/额度用量）。模型/上下文/Total/Cost 来自屏幕抓取；5h/7d 额度来自主进程直读（kimi 云端 /usages、codex 本地 session 文件）。尽力而为，识别不出则为空 */
export interface CliStatus {
  /** 识别出的 CLI 来源（决定挂哪套额度），不展示 */
  source?: 'kimi' | 'codex'
  model?: string
  context?: string
  /** 5 小时窗口用量（kimi） */
  fiveHour?: string
  /** 7 天窗口用量/余量（kimi: "34%"；codex: "0% left"） */
  weekly?: string
  /** 累计 token（kimi 新版状态行） */
  total?: string
  /** 累计花费（kimi 新版状态行） */
  cost?: string
}

export interface TerminalApi {
  loadWorkspace(): Promise<WorkspaceState>
  getTerminalTheme(): Promise<ItermTheme | null>
  onCliStatus(callback: (statuses: Record<string, CliStatus>) => void): () => void
  addProject(): Promise<ProjectDefinition | null>
  removeProject(projectId: string): Promise<WorkspaceState>
  revealProject(projectId: string): Promise<void>
  renameProject(projectId: string, name: string): Promise<WorkspaceState>
  toggleProject(projectId: string): Promise<WorkspaceState>
  createTerminal(input: CreateTerminalInput): Promise<WorkspaceState>
  openTerminal(terminalId: string): Promise<WorkspaceState>
  renameTerminal(terminalId: string, name: string): Promise<WorkspaceState>
  closeTerminal(terminalId: string): Promise<WorkspaceState>
  restartTerminal(terminalId: string): Promise<WorkspaceState>
  setActiveTerminal(terminalId: string): Promise<WorkspaceState>
  write(terminalId: string, data: string): void
  resize(terminalId: string, cols: number, rows: number): void
  onData(callback: (event: TerminalDataEvent) => void): () => void
  onExit(callback: (event: TerminalExitEvent) => void): () => void
  onWorkspaceChange(callback: (workspace: WorkspaceState) => void): () => void
  onCommand(callback: (command: AppCommand) => void): () => void
}
