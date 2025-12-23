import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PythonBackend } from './python-backend'
import { pathToFileURL } from 'url'

let mainWindow: BrowserWindow | null = null
let pythonBackend: PythonBackend | null = null

// Register custom protocol for serving local video files
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFile', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'] }
    ]
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: options?.defaultPath,
    filters: options?.filters || [
      { name: 'Video Files', extensions: ['mkv', 'mp4'] }
    ]
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('backend:getPort', () => {
  return pythonBackend?.getPort() || null
})

ipcMain.handle('backend:isReady', () => {
  return pythonBackend?.isReady() || false
})

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.video-audio-combiner')

  // Register protocol handler for local video files
  protocol.handle('local-video', (request) => {
    // Remove protocol and query string, then decode the path
    let filePath = request.url.replace('local-video://', '')
    const queryIndex = filePath.indexOf('?')
    if (queryIndex !== -1) {
      filePath = filePath.substring(0, queryIndex)
    }
    filePath = decodeURIComponent(filePath)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Start Python backend
  pythonBackend = new PythonBackend()
  try {
    await pythonBackend.start()
    console.log(`Python backend started on port ${pythonBackend.getPort()}`)
  } catch (error) {
    console.error('Failed to start Python backend:', error)
  }

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  pythonBackend?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  pythonBackend?.stop()
})
