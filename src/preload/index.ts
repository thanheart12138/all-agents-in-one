import { contextBridge, ipcRenderer } from 'electron'
import type { TerminalApi, TerminalDataEvent, TerminalExitEvent } from '../shared/types'

const api: TerminalApi = {
  loadWorkspace: () => ipcRenderer.invoke('workspace:load'),
  getTerminalTheme: () => ipcRenderer.invoke('terminal:theme'),
  onCliStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, statuses: Parameters<typeof callback>[0]): void => callback(statuses)
    ipcRenderer.on('terminal:cli-status', listener)
    return () => ipcRenderer.removeListener('terminal:cli-status', listener)
  },
  addProject: () => ipcRenderer.invoke('project:add'),
  removeProject: (projectId) => ipcRenderer.invoke('project:remove', projectId),
  revealProject: (projectId) => ipcRenderer.invoke('project:reveal', projectId),
  renameProject: (projectId, name) => ipcRenderer.invoke('project:rename', projectId, name),
  toggleProject: (projectId) => ipcRenderer.invoke('project:toggle', projectId),
  createTerminal: (input) => ipcRenderer.invoke('terminal:create', input),
  openTerminal: (terminalId) => ipcRenderer.invoke('terminal:open', terminalId),
  renameTerminal: (terminalId, name) => ipcRenderer.invoke('terminal:rename', terminalId, name),
  closeTerminal: (terminalId) => ipcRenderer.invoke('terminal:close', terminalId),
  restartTerminal: (terminalId) => ipcRenderer.invoke('terminal:restart', terminalId),
  setActiveTerminal: (terminalId) => ipcRenderer.invoke('terminal:activate', terminalId),
  write: (terminalId, data) => ipcRenderer.send('terminal:write', terminalId, data),
  resize: (terminalId, cols, rows) => ipcRenderer.send('terminal:resize', terminalId, cols, rows),
  onData: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent): void => callback(payload)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.removeListener('terminal:data', listener)
  },
  onExit: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent): void => callback(payload)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.removeListener('terminal:exit', listener)
  },
  onWorkspaceChange: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, workspace: Parameters<typeof callback>[0]): void => callback(workspace)
    ipcRenderer.on('workspace:changed', listener)
    return () => ipcRenderer.removeListener('workspace:changed', listener)
  },
  onCommand: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, command: Parameters<typeof callback>[0]): void => callback(command)
    ipcRenderer.on('app:command', listener)
    return () => ipcRenderer.removeListener('app:command', listener)
  }
}

contextBridge.exposeInMainWorld('terminalApi', api)
