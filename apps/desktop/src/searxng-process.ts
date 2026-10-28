/** Background SearXNG search service bundled with Desktop and owned by the main process. */

import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'

/** Bundled interpreter, payload, and writable locations for one Desktop run. */
export interface DesktopSearxngOptions {
  /** The primary runtime's Python executable. */
  readonly python: string
  /** Prepared `searxng/` payload directory containing `site-packages/`. */
  readonly root: string
  /** Writable directory for generated settings and the persistent secret. */
  readonly dataDirectory: string
  /** Log file that receives the service's output; replaced at each start. */
  readonly logFile: string
  /** Environment the service inherits; only proxy, locale, and system location variables are passed. */
  readonly environment: NodeJS.ProcessEnv
}

// SearXNG reads its listener from these variables, and the settings file from SEARXNG_SETTINGS_PATH.
const LAUNCHER = 'import runpy, sys; sys.path.insert(0, sys.argv[1]); runpy.run_module("searx.webapp", run_name="__main__")'
const PASSED_ENVIRONMENT = /^(?:PATH|HOME|USERPROFILE|SYSTEMROOT|WINDIR|TEMP|TMP|TMPDIR|LANG|LC_ALL|LC_CTYPE|(?:HTTPS?|ALL|NO)_PROXY|(?:https?|all|no)_proxy|SSL_CERT_FILE|SSL_CERT_DIR)$/u
const RESTART_DELAYS_MS = [1_000, 5_000, 15_000, 60_000]
const STOP_TIMEOUT_MS = 3_000

/**
 * Write the managed settings file, keeping one random secret per Desktop data directory.
 * @param directory - Writable SearXNG data directory.
 * @returns The settings file path.
 */
export function writeDesktopSearxngSettings(directory: string): string {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const secretPath = join(directory, 'secret')
  if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(32).toString('hex'), { mode: 0o600 })
  const secret = readFileSync(secretPath, 'utf8').trim()
  const settings = join(directory, 'settings.yml')
  writeFileSync(settings, [
    'use_default_settings: true',
    'general:',
    '  debug: false',
    'server:',
    `  secret_key: "${secret}"`,
    '  limiter: false',
    '  public_instance: false',
    '  image_proxy: false',
    'search:',
    '  formats: [html, json]',
    '',
  ].join('\n'), { mode: 0o600 })
  return settings
}

/**
 * Reserve a free loopback port; the service binds it moments later.
 * @returns A port the operating system reported free.
 */
export function freeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('desktop searxng: no loopback port'))
        else resolve(address.port)
      })
    })
  })
}

/**
 * Runs SearXNG as a hidden child of the Desktop main process for the whole application run.
 * An unexpected exit restarts it with increasing delays; `stop()` ends it for good.
 */
export class DesktopSearxng {
  private child: ChildProcess | undefined
  private log: WriteStream | undefined
  private restarts = 0
  private restartTimer: ReturnType<typeof setTimeout> | undefined
  private stopped = false
  private port: number | undefined

  constructor(private readonly options: DesktopSearxngOptions) {}

  /**
   * Choose the port and start the service without waiting for it to answer.
   * @returns The service base URL the Host passes to its search provider.
   */
  async start(): Promise<string> {
    this.port ??= await freeLoopbackPort()
    this.spawn()
    return `http://127.0.0.1:${String(this.port)}`
  }

  /**
   * End the service and cancel pending restarts; resolves once the child has exited.
   * @returns Resolves after exit, or after a forced kill when the child ignores termination.
   */
  async stop(): Promise<void> {
    this.stopped = true
    clearTimeout(this.restartTimer)
    const child = this.child
    if (child === undefined || child.exitCode !== null || child.signalCode !== null) { this.log?.end(); return }
    const exited = new Promise<void>((resolve) => { child.once('exit', () => { resolve() }) })
    child.kill('SIGTERM')
    const forced = setTimeout(() => { child.kill('SIGKILL') }, STOP_TIMEOUT_MS)
    await exited
    clearTimeout(forced)
    this.log?.end()
  }

  private spawn(): void {
    if (this.stopped || this.port === undefined) return
    const settings = writeDesktopSearxngSettings(this.options.dataDirectory)
    this.log?.end()
    this.log = createWriteStream(this.options.logFile, { flags: this.restarts === 0 ? 'w' : 'a' })
    const environment = Object.fromEntries(Object.entries(this.options.environment).filter(([name]) => PASSED_ENVIRONMENT.test(name)))
    const child = spawn(this.options.python, ['-I', '-B', '-c', LAUNCHER, join(this.options.root, 'site-packages')], {
      env: { ...environment, SEARXNG_SETTINGS_PATH: settings, SEARXNG_PORT: String(this.port), SEARXNG_BIND_ADDRESS: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    })
    this.child = child
    child.stdout.pipe(this.log, { end: false })
    child.stderr.pipe(this.log, { end: false })
    child.once('error', (error) => { this.log?.write(`desktop searxng: ${error.message}\n`) })
    child.once('exit', (code, signal) => {
      if (this.stopped || this.child !== child) return
      this.log?.write(`desktop searxng: exited with ${signal ?? String(code)}\n`)
      const delay = RESTART_DELAYS_MS[Math.min(this.restarts, RESTART_DELAYS_MS.length - 1)]
      this.restarts++
      this.restartTimer = setTimeout(() => { this.spawn() }, delay)
    })
  }
}
