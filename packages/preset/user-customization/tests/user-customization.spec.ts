import { Context, type Fiber } from '@deepseek-ai/cordis'
import { createVolatile, updateVolatile, type Volatile } from '@deepseek-ai/cosmokit'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as UserSystemPrompt from '@deepseek-ai/dsh-user-customization'
import * as UserMcpServers from '@deepseek-ai/dsh-user-customization/mcp-servers'
import * as UserSkills from '@deepseek-ai/dsh-user-customization/skills'

const { lifecycle } = vi.hoisted(() => ({ lifecycle: [] as string[] }))
vi.mock('@deepseek-ai/dsh-mcp-client', async (load) => {
  const actual = await load<typeof import('@deepseek-ai/dsh-mcp-client')>()
  return {
    ...actual,
    inject: [],
    apply: (ctx: Context, config: { serverName: string; transport: string }) => {
      ctx.effect(() => {
        lifecycle.push(`start ${config.serverName} ${config.transport}`)
        return () => { lifecycle.push(`stop ${config.serverName}`) }
      })
    },
  }
})

const contexts: Context[] = []
afterEach(async () => {
  vi.useRealTimers()
  lifecycle.length = 0
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

/** Write one volatile field the way the settings service does: in place, without a restart. */
function save(fiber: Fiber, field: string, value: unknown): void {
  updateVolatile((fiber.config as Record<string, Volatile<unknown>>)[field]!, createVolatile(value))
}

function root(): Context {
  const ctx = new Context()
  contexts.push(ctx)
  return ctx
}

describe('user system prompt', () => {
  it('places the saved text after the persona, literally, and follows each saved edit', async () => {
    const ctx = root()
    await ctx.plugin(SystemPrompt, { personaPrefix: 'Deployment persona.' })
    ctx.systemPrompt.section({ name: 'tool-guidance', order: 1000, text: 'Use tools.' })
    const fiber = ctx.plugin(UserSystemPrompt, {})
    await fiber
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toMatch(/Deployment persona\.\n\nUse tools\./u)
    save(fiber, 'text', '  Answer in Russian. Keep {{braces}}.\n')
    expect(renderPrompt(await ctx.systemPrompt.assemble()))
      .toMatch(/Deployment persona\.\n\nAnswer in Russian\. Keep \{\{braces\}\}\.\n\nUse tools\./u)
  })

  it('previews the current unscoped prompt, keeping variables that resolve only inside an Agent turn', async () => {
    const ctx = root()
    await ctx.plugin(SystemPrompt, { personaPrefix: 'You are powered by {{model}}.' })
    ctx.systemPrompt.variable('cwd', () => '/work')
    ctx.systemPrompt.section({ name: 'tool-guidance', order: 1000, text: 'Work in {{cwd}}.' })
    const fiber = ctx.plugin(UserSystemPrompt, {})
    await fiber
    expect((await ctx.userSystemPrompt.preview()).text).toMatch(/\n\nYou are powered by \{\{model\}\}\.\n\nWork in \/work\.$/u)
    save(fiber, 'text', 'Answer in Russian.')
    expect((await ctx.userSystemPrompt.preview()).text)
      .toMatch(/\n\nYou are powered by \{\{model\}\}\.\n\nAnswer in Russian\.\n\nWork in \/work\.$/u)
  })
})

describe('user MCP servers', () => {
  it('connects enabled valid servers and reconciles only what a saved list changes', async () => {
    vi.useFakeTimers()
    const ctx = root()
    await ctx.plugin(SystemPrompt, {})
    await ctx.plugin(ToolRuntime)
    const entry = { enabled: true, args: [], env: {}, headers: {}, command: '', url: '' }
    const servers: UserMcpServers.McpServerEntry[] = [
      { ...entry, name: 'files', transport: 'stdio', command: 'npx', args: ['-y', 'server-files'] },
      { ...entry, name: 'web', transport: 'streamable-http', url: 'http://127.0.0.1:3000/mcp' },
      { ...entry, name: 'off', transport: 'stdio', command: 'x', enabled: false },
      { ...entry, name: 'bad name', transport: 'stdio', command: 'x' },
      { ...entry, name: 'nourl', transport: 'streamable-http', url: 'not a url' },
    ]
    const fiber = ctx.plugin(UserMcpServers, { servers, pollIntervalMs: 1000 })
    await fiber
    await vi.advanceTimersByTimeAsync(0)
    expect(lifecycle).toEqual(['start files stdio', 'start web streamable-http'])
    lifecycle.length = 0
    save(fiber, 'servers', [
      { ...entry, name: 'files', transport: 'stdio', command: 'npx', args: ['-y', 'server-files'] },
      { ...entry, name: 'web', transport: 'streamable-http', url: 'http://127.0.0.1:4000/mcp' },
    ])
    await vi.advanceTimersByTimeAsync(1000)
    expect(lifecycle).toEqual(['stop web', 'start web streamable-http'])
    lifecycle.length = 0
    save(fiber, 'servers', [])
    await vi.advanceTimersByTimeAsync(1000)
    expect(lifecycle.sort()).toEqual(['stop files', 'stop web'])
  })

  it('explains entries that cannot connect', () => {
    const base = { name: 'x', enabled: true, args: [], env: {}, headers: {}, command: '', url: '' }
    expect(UserMcpServers.mcpClientConfig({ ...base, transport: 'stdio' })).toEqual({ problem: 'a stdio server needs a command' })
    expect(UserMcpServers.mcpClientConfig({ ...base, name: '', transport: 'stdio', command: 'x' })).toHaveProperty('problem')
    expect(UserMcpServers.mcpClientConfig({ ...base, transport: 'stdio', command: ' node ' })).toMatchObject({ config: { command: 'node', serverName: 'x' } })
  })
})

describe('user skills', () => {
  it('registers enabled valid skills globally and replaces them after a saved change', async () => {
    vi.useFakeTimers()
    const ctx = root()
    await ctx.plugin(SkillRegistry)
    const skills: UserSkills.UserSkillEntry[] = [
      { name: 'release-notes', enabled: true, description: 'Write release notes.', content: '# Steps' },
      { name: 'hidden', enabled: false, description: 'Off.', content: '' },
      { name: 'Bad Name', enabled: true, description: 'Invalid.', content: '' },
      { name: 'no-description', enabled: true, description: ' ', content: '' },
    ]
    const fiber = ctx.plugin(UserSkills, { skills, pollIntervalMs: 1000 })
    await fiber
    expect((await ctx.skills.list()).map(skill => skill.name)).toEqual(['release-notes'])
    expect((await ctx.skills.get('release-notes'))?.content).toBe('# Steps')
    save(fiber, 'skills', [{ name: 'code-review', enabled: true, description: 'Review code.', content: 'Check tests.' }])
    await vi.advanceTimersByTimeAsync(1000)
    expect((await ctx.skills.list()).map(skill => skill.name)).toEqual(['code-review'])
  })
})
