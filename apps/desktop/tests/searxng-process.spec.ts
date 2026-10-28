import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopSearxng, writeDesktopSearxngSettings } from '../src/searxng-process.ts'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })

function temporary(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-searxng-'))
  directories.push(directory)
  return directory
}

/** A stand-in interpreter that records its launch and then behaves as `body` says. */
function fakePython(directory: string, body: string): string {
  const path = join(directory, 'python3')
  writeFileSync(path, `#!/bin/sh\necho "$SEARXNG_BIND_ADDRESS:$SEARXNG_PORT $SEARXNG_SETTINGS_PATH $5 \${DEEPSEEK_API_KEY:-none}" >> "${join(directory, 'launches')}"\n${body}\n`)
  chmodSync(path, 0o755)
  return path
}

describe('managed SearXNG settings', () => {
  it('keeps one secret per data directory and enables the JSON format', () => {
    const directory = temporary()
    const first = readFileSync(writeDesktopSearxngSettings(directory), 'utf8')
    const second = readFileSync(writeDesktopSearxngSettings(directory), 'utf8')
    expect(second).toBe(first)
    expect(first).toMatch(/secret_key: "[0-9a-f]{64}"/u)
    expect(first).toContain('formats: [html, json]')
    expect(first).toContain('public_instance: false')
  })
})

describe.skipIf(process.platform === 'win32')('DesktopSearxng', () => {
  it('starts on loopback with filtered environment, restarts after an unexpected exit, and stops for good', async () => {
    const directory = temporary()
    const python = fakePython(directory, `[ -f "${join(directory, 'launches')}.once" ] && exec sleep 30\ntouch "${join(directory, 'launches')}.once"\nexit 3`)
    const service = new DesktopSearxng({
      python, root: join(directory, 'payload'), dataDirectory: join(directory, 'data'), logFile: join(directory, 'searxng.log'),
      environment: { PATH: process.env.PATH, HTTPS_PROXY: 'http://proxy.test:3128', DEEPSEEK_API_KEY: 'secret-key' },
    })
    const url = await service.start()
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u)
    await vi.waitFor(() => { expect(readFileSync(join(directory, 'launches'), 'utf8').trim().split('\n')).toHaveLength(2) }, { timeout: 5_000 })
    const launches = readFileSync(join(directory, 'launches'), 'utf8').trim().split('\n')
    const port = new URL(url).port
    for (const line of launches) {
      expect(line).toBe(`127.0.0.1:${port} ${join(directory, 'data', 'settings.yml')} ${join(directory, 'payload', 'site-packages')} none`)
    }
    expect(readFileSync(join(directory, 'searxng.log'), 'utf8')).toContain('desktop searxng: exited with 3')
    await service.stop()
    await new Promise(resolve => setTimeout(resolve, 1_500))
    expect(readFileSync(join(directory, 'launches'), 'utf8').trim().split('\n')).toHaveLength(2)
  }, 15_000)
})
