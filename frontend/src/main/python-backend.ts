import { spawn, ChildProcess, execSync } from 'child_process'
import { join } from 'path'
import { app, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { net } from 'electron'
import { existsSync } from 'fs'

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

    const backendPath = this.getBackendPath()

    // In production, ensure Python is available and venv is set up
    if (!is.dev) {
      const pythonAvailable = await this.checkPythonAvailable()
      if (!pythonAvailable) {
        await dialog.showErrorBox(
          'Python Required',
          'Video Audio Combiner requires Python 3.11 or later.\n\n' +
            'Please install Python from:\n' +
            '- macOS: brew install python@3.11\n' +
            '- Or download from python.org\n\n' +
            'Then restart the application.'
        )
        app.quit()
        return
      }

      // Set up virtual environment on first run
      await this.ensureVenvSetup(backendPath)
    }

    return new Promise((resolve, reject) => {
      // Use uv run in development, venv python in production
      let command: string
      let args: string[]
      let env = { ...process.env }

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
        // In production, use the virtual environment
        const venvPython = join(backendPath, '.venv', 'bin', 'python')
        command = venvPython
        args = [
          '-m',
          'uvicorn',
          'video_audio_combiner.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          this.port.toString()
        ]
        // Add src directory to PYTHONPATH for imports
        env.PYTHONPATH = join(backendPath, 'src')
      }

      this.process = spawn(command, args, {
        cwd: backendPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env
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

  private async checkPythonAvailable(): Promise<boolean> {
    const pythonCommands = ['python3', 'python']
    for (const cmd of pythonCommands) {
      try {
        const version = execSync(`${cmd} --version`, { encoding: 'utf-8' })
        const match = version.match(/Python (\d+)\.(\d+)/)
        if (match) {
          const major = parseInt(match[1])
          const minor = parseInt(match[2])
          if (major >= 3 && minor >= 11) {
            console.log(`Found Python: ${version.trim()}`)
            return true
          }
        }
      } catch {
        // Command not found, try next
      }
    }
    return false
  }

  private async ensureVenvSetup(backendPath: string): Promise<void> {
    const venvPath = join(backendPath, '.venv')
    const requirementsPath = join(backendPath, 'requirements.txt')

    if (existsSync(venvPath)) {
      console.log('Virtual environment already exists')
      return
    }

    console.log('Setting up virtual environment for first run...')

    try {
      // Create virtual environment
      execSync('python3 -m venv .venv', { cwd: backendPath, stdio: 'inherit' })

      // Install dependencies
      if (existsSync(requirementsPath)) {
        const pipPath = join(venvPath, 'bin', 'pip')
        execSync(`${pipPath} install -r requirements.txt`, { cwd: backendPath, stdio: 'inherit' })
      }

      console.log('Virtual environment setup complete')
    } catch (error) {
      console.error('Failed to set up virtual environment:', error)
      throw error
    }
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
      // Production: backend is bundled in app resources
      return join(process.resourcesPath, 'backend')
    }
  }
}
