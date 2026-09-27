import { useEffect, useMemo, useState } from 'react'
import type { AppCommand, CliStatus, ItermTheme, ProjectDefinition, TerminalDefinition, WorkspaceState } from '../../shared/types'
import { TerminalView, clearTerminalOutput, focusTerminal, writeTerminalData } from './TerminalView'
import { CommandIcon } from './CommandIcon'

const emptyWorkspace: WorkspaceState = { projects: [], activeTerminalId: null }

type DialogState =
  | { kind: 'rename-project'; project: ProjectDefinition }
  | { kind: 'rename-terminal'; terminal: TerminalDefinition }
  | { kind: 'remove-project'; project: ProjectDefinition }
  | { kind: 'close-terminal'; terminal: TerminalDefinition }
  | null

type ContextState =
  | { kind: 'project'; project: ProjectDefinition; x: number; y: number }
  | { kind: 'terminal'; terminal: TerminalDefinition; x: number; y: number }
  | null

const statusLabels = { starting: 'Starting', ready: 'Ready', running: 'Running', detached: '已分离', exited: '已退出', missing: '待恢复', error: '启动失败' } as const

export function App(): React.JSX.Element {
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [contextMenu, setContextMenu] = useState<ContextState>(null)
  const [toast, setToast] = useState<string | null>(null)
  // undefined = 主题尚未加载完成（先不创建终端视图，避免用默认主题渲染后再重建）
  const [itermTheme, setItermTheme] = useState<ItermTheme | null | undefined>(undefined)
  const [fontSizeOffset, setFontSizeOffset] = useState(0)
  const [cliStatuses, setCliStatuses] = useState<Record<string, CliStatus>>({})
  const [dragTarget, setDragTarget] = useState<string | null>(null)

  const terminals = useMemo(() => workspace.projects.flatMap((project) => project.terminals), [workspace.projects])
  const pendingCount = terminals.filter((terminal) => terminal.status === 'ready' && terminal.needsAttention).length
  const activeTerminal = terminals.find((terminal) => terminal.id === workspace.activeTerminalId) ?? null
  const activeProject = activeTerminal
    ? workspace.projects.find((project) => project.id === activeTerminal.projectId) ?? null
    : workspace.projects[0] ?? null
  const baseFontSize = itermTheme?.fontSize ?? 14
  const terminalFontSize = Math.max(8, Math.min(40, baseFontSize + fontSizeOffset))

  useEffect(() => {
    const disposeData = window.terminalApi.onData(({ terminalId, data }) => writeTerminalData(terminalId, data))
    const disposeExit = window.terminalApi.onExit(({ terminalId, exitCode }) => {
      setWorkspace((current) => ({
        ...current,
        projects: current.projects.map((project) => ({
          ...project,
          terminals: project.terminals.map((terminal) => terminal.id === terminalId ? { ...terminal, status: 'exited', exitCode } : terminal)
        }))
      }))
    })
    const disposeWorkspaceChange = window.terminalApi.onWorkspaceChange(setWorkspace)
    const disposeCliStatus = window.terminalApi.onCliStatus(setCliStatuses)
    void window.terminalApi.loadWorkspace().then(setWorkspace).catch(showError).finally(() => setLoading(false))
    void window.terminalApi.getTerminalTheme().then(setItermTheme).catch(() => setItermTheme(null))
    return () => { disposeData(); disposeExit(); disposeWorkspaceChange(); disposeCliStatus() }
  }, [])

  useEffect(() => {
    const disposeCommand = window.terminalApi.onCommand(handleCommand)
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (/^[1-9]$/.test(event.key)) {
        const terminal = terminals[Number(event.key) - 1]
        if (terminal) { event.preventDefault(); void activateTerminal(terminal.id) }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { disposeCommand(); window.removeEventListener('keydown', handleKeyDown) }
  }, [activeProject, activeTerminal, terminals, baseFontSize])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timer)
  }, [toast])

  function showError(error: unknown): void {
    setToast(error instanceof Error ? error.message : '操作失败，请重试')
  }

  function handleCommand(command: AppCommand): void {
    if (command === 'add-project') void addProject()
    if (command === 'new-terminal' && activeProject) void createTerminal(activeProject)
    if (command === 'close-terminal' && activeTerminal) setDialog({ kind: 'close-terminal', terminal: activeTerminal })
    if (command === 'restart-terminal' && activeTerminal) void restartTerminal(activeTerminal)
    if (command === 'rename-terminal' && activeTerminal) setDialog({ kind: 'rename-terminal', terminal: activeTerminal })
    if (command === 'zoom-in') zoomTerminal('in')
    if (command === 'zoom-out') zoomTerminal('out')
    if (command === 'zoom-reset') setFontSizeOffset(0)
  }

  function zoomTerminal(direction: 'in' | 'out'): void {
    setFontSizeOffset((offset) => Math.max(8 - baseFontSize, Math.min(40 - baseFontSize, offset + (direction === 'in' ? 1 : -1))))
  }

  async function addProject(): Promise<void> {
    try {
      const project = await window.terminalApi.addProject()
      if (project) setWorkspace(await window.terminalApi.loadWorkspace())
    } catch (error) { showError(error) }
  }

  async function createTerminal(project: ProjectDefinition): Promise<void> {
    try {
      const state = await window.terminalApi.createTerminal({ projectId: project.id })
      setWorkspace(state)
      const created = state.projects.find((item) => item.id === project.id)?.terminals.at(-1)
      if (created?.status === 'error') setToast(created.error ?? '终端启动失败')
    } catch (error) { showError(error) }
  }

  async function openTerminal(terminal: TerminalDefinition): Promise<void> {
    try { setWorkspace(await window.terminalApi.openTerminal(terminal.id)) } catch (error) { showError(error) }
  }

  async function activateTerminal(terminalId: string): Promise<void> {
    try { setWorkspace(await window.terminalApi.setActiveTerminal(terminalId)) } catch (error) { showError(error) }
  }

  async function renameProject(project: ProjectDefinition, name: string): Promise<void> {
    try { setWorkspace(await window.terminalApi.renameProject(project.id, name)); setDialog(null) } catch (error) { showError(error) }
  }

  async function removeProject(project: ProjectDefinition): Promise<void> {
    try { setWorkspace(await window.terminalApi.removeProject(project.id)); setDialog(null) } catch (error) { showError(error) }
  }

  async function renameTerminal(terminal: TerminalDefinition, name: string): Promise<void> {
    try { setWorkspace(await window.terminalApi.renameTerminal(terminal.id, name)); setDialog(null) } catch (error) { showError(error) }
  }

  async function closeTerminal(terminal: TerminalDefinition): Promise<void> {
    try { clearTerminalOutput(terminal.id); setWorkspace(await window.terminalApi.closeTerminal(terminal.id)); setDialog(null) } catch (error) { showError(error) }
  }

  async function restartTerminal(terminal: TerminalDefinition): Promise<void> {
    try {
      clearTerminalOutput(terminal.id)
      const state = await window.terminalApi.restartTerminal(terminal.id)
      setWorkspace(state)
      if (state.activeTerminalId === terminal.id) focusTerminal(terminal.id)
    } catch (error) { showError(error) }
  }

  async function moveProject(projectId: string, current: boolean, beforeProjectId?: string): Promise<void> {
    setDragTarget(null)
    try { setWorkspace(await window.terminalApi.moveProject(projectId, current, beforeProjectId)) } catch (error) { showError(error) }
  }

  return (
    <main className="app-shell" onClick={() => setContextMenu(null)}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span>›</span><i /></div><div><h1>One</h1><p>All agents in one.</p></div></div>
        <div className="section-heading"><span>项目</span><div className="section-actions">{pendingCount > 0 && <span className="pending-count">{pendingCount} 待查看</span>}<button className="icon-button" onClick={() => void addProject()} title="添加项目（⌘⇧O）">＋</button></div></div>

        <div className="project-list">
          {!loading && workspace.projects.length === 0 && <button className="empty-projects" onClick={() => void addProject()}><strong>添加第一个项目</strong><span>选择一个本地目录开始</span></button>}
          {([true, false] as const).map((current) => <div className={`project-group ${dragTarget === String(current) ? 'drop-target' : ''}`} key={String(current)} onDragOver={(event) => { event.preventDefault(); setDragTarget(String(current)) }} onDrop={(event) => { event.preventDefault(); void moveProject(event.dataTransfer.getData('text/plain'), current) }}>
            <div className="project-group-heading"><span>{current ? '当前项目' : '历史项目'}</span><small>{workspace.projects.filter((project) => project.current === current).length}</small></div>
            {current && workspace.projects.every((project) => !project.current) && <div className="project-group-empty">拖动项目到这里，安排今天的工作</div>}
          {workspace.projects.filter((project) => project.current === current).map((project) => (
            <section className={`project ${dragTarget === project.id ? 'drop-target' : ''}`} key={project.id} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDragTarget(project.id) }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void moveProject(event.dataTransfer.getData('text/plain'), current, project.id) }}>
              <div className="project-row" draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', project.id); event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => setDragTarget(null)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ kind: 'project', project, x: event.clientX, y: event.clientY }) }}>
                <button className="project-title" onClick={async () => setWorkspace(await window.terminalApi.toggleProject(project.id))}>
                  <span className={`chevron ${project.expanded ? 'expanded' : ''}`}>›</span><span className="folder">▱</span><span className="project-name">{project.name}</span>
                  {project.terminals.some((terminal) => terminal.status === 'ready' && terminal.needsAttention) && <span className="project-pending" title="有待查看的会话" />}
                  {project.gitBranch && <span className="branch-badge" title={`Git 分支：${project.gitBranch}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" /></svg><span>{project.gitBranch}</span></span>}
                </button>
                <div className="row-actions">
                  <button onClick={() => void createTerminal(project)} title="新建终端">＋</button>
                  <button onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setContextMenu({ kind: 'project', project, x: rect.right, y: rect.bottom }) }} title="项目菜单">•••</button>
                </div>
              </div>
              {project.expanded && <div className="terminal-list">
                {project.terminals.map((terminal) => <button key={terminal.id} className={`terminal-row ${terminal.id === workspace.activeTerminalId ? 'active' : ''}`} onClick={() => void activateTerminal(terminal.id)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ kind: 'terminal', terminal, x: event.clientX, y: event.clientY }) }}>
                  <CommandIcon commandName={terminal.name} /><span className="terminal-meta"><span className="terminal-summary"><strong>{terminal.name}</strong><span className={`status-dot ${terminal.status}`} /><small>{statusLabels[terminal.status]}{terminal.exitCode !== undefined ? ` · ${terminal.exitCode}` : ''}</small>{terminal.status === 'ready' && terminal.needsAttention && <span className="attention-badge">待查看</span>}</span><span className={`terminal-preview ${terminal.lastUserMessage ? '' : 'empty'}`}>{terminal.lastUserMessage || '新会话'}</span></span>
                </button>)}
                {project.terminals.length === 0 && <button className="new-terminal" onClick={() => void createTerminal(project)}>＋ 新建终端</button>}
              </div>}
            </section>
          ))}
          </div>)}
        </div>
        <div className="sidebar-footer"><span>{terminals.length} 个终端</span><span>⌘1–9 切换</span></div>
      </aside>

      <section className="workspace">
        {activeTerminal ? <>
          <div className="cli-statusbar">
            <span className="seg seg-project">[<em>{activeProject?.name}</em>]{activeProject?.gitBranch && <i>({activeProject.gitBranch})</i>}</span>
            <span className="sep">|</span>
            <span className="seg"><label>CLI:</label>{activeTerminal.name}</span>
            {cliStatuses[activeTerminal.id]?.total && <>
              <span className="sep">|</span>
              <span className="seg"><label>Total:</label>{cliStatuses[activeTerminal.id].total}</span>
            </>}
            {cliStatuses[activeTerminal.id]?.cost && <>
              <span className="sep">|</span>
              <span className="seg"><label>Cost:</label>{cliStatuses[activeTerminal.id].cost}</span>
            </>}
            {cliStatuses[activeTerminal.id]?.fiveHour && <>
              <span className="sep">|</span>
              <span className="seg"><label>5h:</label>{cliStatuses[activeTerminal.id].fiveHour}</span>
            </>}
            {cliStatuses[activeTerminal.id]?.weekly && <>
              <span className="sep">|</span>
              <span className="seg"><label>7d:</label>{cliStatuses[activeTerminal.id].weekly}</span>
            </>}
            {cliStatuses[activeTerminal.id]?.model && <>
              <span className="sep">|</span>
              <span className="seg"><label>Model:</label>{cliStatuses[activeTerminal.id].model}</span>
            </>}
            {cliStatuses[activeTerminal.id]?.context && <>
              <span className="sep">|</span>
              <span className="seg"><label>ctx:</label>{cliStatuses[activeTerminal.id].context}</span>
            </>}
            <span className="sep">|</span>
            <span className="seg"><label>tmux:</label>{activeTerminal.tmuxSessionName ?? '—'}</span>
            <span className="sep">|</span>
            <span className="seg seg-input"><label>最近输入:</label>{activeTerminal.lastUserMessage || '—'}</span>
            <span className="sep">|</span>
            <span className={`seg seg-status ${activeTerminal.status}`}>{statusLabels[activeTerminal.status]}</span>
          </div>
          <header className="terminal-header"><div className="terminal-heading"><span className={`header-status ${activeTerminal.status}`} /><div><strong>{activeTerminal.name}</strong><span>{activeProject?.path}</span></div></div><div className="header-actions"><button onClick={() => void openTerminal(activeTerminal)} title="在 iTerm2 窗口中接管此会话">iTerm</button><button onClick={() => setDialog({ kind: 'rename-terminal', terminal: activeTerminal })}>重命名</button><button onClick={() => void restartTerminal(activeTerminal)}>重启</button><button className="danger" onClick={() => setDialog({ kind: 'close-terminal', terminal: activeTerminal })}>关闭</button></div></header>
          <div className="terminal-stage">{itermTheme !== undefined && terminals.map((terminal) => <TerminalView key={terminal.id} terminalId={terminal.id} terminalName={terminal.name} active={terminal.id === activeTerminal.id} status={terminal.status} error={terminal.error} itermTheme={itermTheme} fontSize={terminalFontSize} onZoom={zoomTerminal} />)}</div>
        </> : <div className="welcome"><div className="welcome-mark">›_</div><h2>All Agents in One</h2><p>{workspace.projects.length ? '创建一个终端，然后直接输入命令。' : <>把 Codex、Claude Code 和普通 Shell<br />放进同一个项目工作台。</>}</p><button onClick={() => activeProject ? void createTerminal(activeProject) : void addProject()}>{activeProject ? '新建终端' : '添加项目'}</button></div>}
      </section>

      {dialog && <Dialog state={dialog} onCancel={() => setDialog(null)} onRenameProject={renameProject} onRenameTerminal={renameTerminal} onRemoveProject={removeProject} onCloseTerminal={closeTerminal} />}
      {contextMenu && <ContextMenu state={contextMenu} onClose={() => setContextMenu(null)} onNewTerminal={(project) => void createTerminal(project)} onMoveProject={(project) => void moveProject(project.id, !project.current)} onRenameProject={(project) => setDialog({ kind: 'rename-project', project })} onRemoveProject={(project) => setDialog({ kind: 'remove-project', project })} onOpenTerminal={(terminal) => void openTerminal(terminal)} onRenameTerminal={(terminal) => setDialog({ kind: 'rename-terminal', terminal })} onCloseTerminal={(terminal) => setDialog({ kind: 'close-terminal', terminal })} onRestartTerminal={restartTerminal} />}
      {toast && <div className="toast" role="alert">{toast}<button onClick={() => setToast(null)}>×</button></div>}
    </main>
  )
}

interface DialogProps {
  state: Exclude<DialogState, null>; onCancel(): void
  onRenameProject(project: ProjectDefinition, name: string): Promise<void>
  onRenameTerminal(terminal: TerminalDefinition, name: string): Promise<void>
  onRemoveProject(project: ProjectDefinition): Promise<void>; onCloseTerminal(terminal: TerminalDefinition): Promise<void>
}

function Dialog(props: DialogProps): React.JSX.Element {
  const { state } = props
  const [name, setName] = useState(state.kind === 'rename-project' ? state.project.name : state.kind === 'rename-terminal' ? state.terminal.name : '')
  const destructive = state.kind === 'remove-project' || state.kind === 'close-terminal'
  const title = state.kind === 'rename-project' ? '重命名项目' : state.kind === 'rename-terminal' ? '重命名终端' : state.kind === 'remove-project' ? '移除项目' : '关闭终端'
  function submit(event: React.FormEvent): void {
    event.preventDefault()
    if (state.kind === 'rename-project' && name.trim()) void props.onRenameProject(state.project, name.trim())
    if (state.kind === 'rename-terminal' && name.trim()) void props.onRenameTerminal(state.terminal, name.trim())
    if (state.kind === 'remove-project') void props.onRemoveProject(state.project)
    if (state.kind === 'close-terminal') void props.onCloseTerminal(state.terminal)
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onCancel() }}><form className="modal" onSubmit={submit}>
    <header><h3>{title}</h3><button type="button" onClick={props.onCancel}>×</button></header>
    {(state.kind === 'rename-project' || state.kind === 'rename-terminal') && <label>新名称<input value={name} onChange={(event) => setName(event.target.value)} autoFocus required /></label>}
    {state.kind === 'remove-project' && <p className="confirm-copy">确定从侧栏移除“{state.project.name}”吗？项目文件不会被删除，但其中运行的终端都会关闭。</p>}
    {state.kind === 'close-terminal' && <p className="confirm-copy">确定关闭“{state.terminal.name}”吗？其中正在运行的进程会被终止。</p>}
    <footer><button type="button" onClick={props.onCancel}>取消</button><button className={destructive ? 'destructive' : 'primary'} type="submit">{destructive ? '确认' : '保存'}</button></footer>
  </form></div>
}

interface ContextMenuProps {
  state: Exclude<ContextState, null>; onClose(): void; onNewTerminal(project: ProjectDefinition): void
  onMoveProject(project: ProjectDefinition): void
  onRenameProject(project: ProjectDefinition): void; onRemoveProject(project: ProjectDefinition): void
  onOpenTerminal(terminal: TerminalDefinition): void
  onRenameTerminal(terminal: TerminalDefinition): void; onCloseTerminal(terminal: TerminalDefinition): void
  onRestartTerminal(terminal: TerminalDefinition): Promise<void>
}

function ContextMenu(props: ContextMenuProps): React.JSX.Element {
  const { state } = props
  const style = { left: Math.min(state.x, window.innerWidth - 190), top: Math.min(state.y, window.innerHeight - 180) }
  const action = (callback: () => void): void => { props.onClose(); callback() }
  return <div className="context-menu" style={style} onClick={(event) => event.stopPropagation()}>{state.kind === 'project' ? <>
    <button onClick={() => action(() => props.onNewTerminal(state.project))}>新建终端 <kbd>⌘T</kbd></button><button onClick={() => action(() => props.onMoveProject(state.project))}>移至{state.project.current ? '历史项目' : '当前项目'}</button><button onClick={() => action(() => props.onRenameProject(state.project))}>重命名</button><button onClick={() => action(() => void window.terminalApi.revealProject(state.project.id))}>在 Finder 中显示</button><hr /><button className="danger" onClick={() => action(() => props.onRemoveProject(state.project))}>移除项目</button>
  </> : <><button onClick={() => action(() => props.onOpenTerminal(state.terminal))}>在 iTerm 中打开</button><button onClick={() => action(() => void props.onRestartTerminal(state.terminal))}>重启 <kbd>⌘⇧R</kbd></button><button onClick={() => action(() => props.onRenameTerminal(state.terminal))}>重命名 <kbd>F2</kbd></button><hr /><button className="danger" onClick={() => action(() => props.onCloseTerminal(state.terminal))}>关闭 <kbd>⌘W</kbd></button></>}</div>
}
