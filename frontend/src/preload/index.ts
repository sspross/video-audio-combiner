import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface OpenFileOptions {
  filters?: FileFilter[]
}

export interface SaveFileOptions {
  defaultPath?: string
  filters?: FileFilter[]
}

export interface ElectronAPI {
  openFile: (options?: OpenFileOptions) => Promise<string | null>
  saveFile: (options?: SaveFileOptions) => Promise<string | null>
  getBackendPort: () => Promise<number | null>
  isBackendReady: () => Promise<boolean>
  getPathForFile: (file: File) => string
  showExportSuccess: (outputPath: string) => Promise<void>
  showExportError: (errorMessage: string) => Promise<void>
}

const api: ElectronAPI = {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  getBackendPort: () => ipcRenderer.invoke('backend:getPort'),
  isBackendReady: () => ipcRenderer.invoke('backend:isReady'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  showExportSuccess: (outputPath) => ipcRenderer.invoke('dialog:showExportSuccess', outputPath),
  showExportError: (errorMessage) => ipcRenderer.invoke('dialog:showExportError', errorMessage)
}

contextBridge.exposeInMainWorld('electron', api)
