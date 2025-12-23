import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { net } from 'electron'

export class PythonBackend {
  private process: ChildProcess | null = null
  private port: number = 8765
  private ready: boolean = false

  async start(): Promise<void> {
    // First check if backend is already running (e.g., started manually)
    const alreadyRunning = await this.checkHealth()
    if (alreadyRunning) {
      console.log('Python backend already running on port', this.port)
      this.ready = true
      return
    }

    return new Promise((resolve, reject) => {
      const backendPath = this.getBackendPath()

      // Use uv run in development, direct python in production
      let command: string
      let args: string[]

      if (is.dev) {
        command = 'uv'
        args = [
          'run',
          'uvicorn',
          'video_audio_combiner.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          this.port.toString()
        ]
      } else {
        // In production, use bundled Python or system Python
        command = 'python'
        args = [
          '-m',
          'uvicorn',
          'video_audio_combiner.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          this.port.toString()
        ]
      }

      this.process = spawn(command, args, {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log('[Python Backend]', output)
        if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
          this.ready = true
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        console.error('[Python Backend Error]', output)
        // Uvicorn logs to stderr
        if (output.includes('Application startup complete') || output.includes('Uvicorn running')) {
          this.ready = true
          resolve()
        }
        // Handle port already in use - try to use existing backend
        if (output.includes('address already in use')) {
          console.log('Port in use, checking if backend is already running...')
          this.checkHealth().then((running) => {
            if (running) {
              this.ready = true
              resolve()
            } else {
              reject(new Error('Port 8765 is in use but backend is not responding'))
            }
          })
        }
      })

      this.process.on('error', (error) => {
        console.error('Failed to start Python backend:', error)
        reject(error)
      })

      this.process.on('exit', (code) => {
        console.log(`Python backend exited with code ${code}`)
        // Don't set ready to false if we detected existing backend
        if (this.process) {
          this.ready = false
        }
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.ready) {
          reject(new Error('Python backend startup timeout'))
        }
      }, 30000)
    })
  }

  private async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: `http://127.0.0.1:${this.port}/api/health`
      })

      request.on('response', (response) => {
        resolve(response.statusCode === 200)
      })

      request.on('error', () => {
        resolve(false)
      })

      // Timeout for health check
      setTimeout(() => resolve(false), 2000)

      request.end()
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
      this.ready = false
    }
  }

  getPort(): number {
    return this.port
  }

  isReady(): boolean {
    return this.ready
  }

  private getBackendPath(): string {
    if (is.dev) {
      // Development: backend is in the parent directory
      return join(app.getAppPath(), '..', 'backend')
    } else {
      // Production: backend is bundled with the app
      return join(app.getAppPath(), 'backend')
    }
  }
}
