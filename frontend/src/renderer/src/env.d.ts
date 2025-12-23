/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { [key: string]: string }
  export default classes
}

interface ElectronAPI {
  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
  saveFile: (options?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
  getBackendPort: () => Promise<number | null>
  isBackendReady: () => Promise<boolean>
  getPathForFile: (file: File) => string
}

interface Window {
  electron: ElectronAPI
}
