import type { ProjectDefinition } from '../shared/types'

export function moveProject(
  projects: ProjectDefinition[],
  projectId: string,
  current: boolean,
  beforeProjectId?: string
): ProjectDefinition[] {
  if (projectId === beforeProjectId) return projects
  const projectIndex = projects.findIndex((project) => project.id === projectId)
  if (projectIndex < 0) return projects

  const next = [...projects]
  const [project] = next.splice(projectIndex, 1)
  const movedProject = { ...project, current }
  const beforeIndex = next.findIndex((item) => item.id === beforeProjectId && item.current === current)
  if (beforeIndex >= 0) next.splice(beforeIndex, 0, movedProject)
  else {
    const lastIndex = next.map((item) => item.current).lastIndexOf(current)
    next.splice(lastIndex + 1, 0, movedProject)
  }
  return next
}

export function shouldMarkReadyForAttention(
  terminalId: string,
  activeTerminalId: string | null,
  windowFocused: boolean
): boolean {
  return terminalId !== activeTerminalId || !windowFocused
}
