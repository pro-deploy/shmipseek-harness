/**
 * The user's MCP servers, edited from the client settings page. Each enabled entry mounts
 * one `dsh-mcp-client` child in this plugin's scope; a saved list is reconciled within one
 * poll interval: removed or changed servers disconnect, new ones connect, unchanged ones stay.
 *
 * @module @deepseek-ai/dsh-user-customization/mcp-servers
 */

import type { Context, Fiber, Volatile } from '@deepseek-ai/cordis'
import type { VolatileSnapshot } from '@deepseek-ai/cosmokit'
import z from '@deepseek-ai/schemastery'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'user-mcp-servers'

/** The tool registry the child MCP clients register into. */
export const inject = ['tools']

/** One user-defined MCP server. */
export interface McpServerEntry {
  /** Tool namespace: `[A-Za-z0-9_-]{1,32}`, unique in the list. */
  name: string
  /** Whether the server is connected. */
  enabled: boolean
  /** `stdio` runs a local program; `streamable-http` reaches a URL. */
  transport: 'stdio' | 'streamable-http'
  /** stdio: executable. */
  command: string
  /** stdio: arguments. */
  args: string[]
  /** stdio: extra environment variables. */
  env: Record<string, string>
  /** streamable-http: endpoint URL. */
  url: string
  /** streamable-http: extra request headers. */
  headers: Record<string, string>
}

/** Plugin config. */
export interface Config {
  /** The user's servers in display order. */
  servers: Volatile<McpServerEntry[]>
  /** How often a saved list is compared with the connected set, in milliseconds. */
  pollIntervalMs: number
}

const Server: z<McpServerEntry> = z.object({
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  transport: z.union(['stdio', 'streamable-http'] as const).default('stdio'),
  command: z.string().default(''),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  url: z.string().default(''),
  headers: z.dict(String).default({}),
})

export const Config = z.object({
  servers: z.array(Server).default([]).volatile(),
  pollIntervalMs: z.natural().min(100).required(),
})

const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/u

/**
 * Translate one entry into `dsh-mcp-client` configuration, or explain why it cannot connect.
 * @param entry - the saved entry.
 * @returns the client configuration, or the reason the entry is skipped.
 */
export function mcpClientConfig(entry: VolatileSnapshot<McpServerEntry>): { config: McpClient.Config } | { problem: string } {
  if (!SERVER_NAME.test(entry.name)) return { problem: 'the name must be 1 to 32 letters, digits, "-" or "_"' }
  if (entry.transport === 'stdio') {
    if (entry.command.trim() === '') return { problem: 'a stdio server needs a command' }
    return { config: McpClient.Config({ transport: 'stdio', serverName: entry.name, command: entry.command.trim(), args: [...entry.args], env: { ...entry.env } }) }
  }
  if (!URL.canParse(entry.url.trim())) return { problem: 'a streamable-http server needs an absolute URL' }
  return { config: McpClient.Config({ transport: 'streamable-http', serverName: entry.name, url: entry.url.trim(), headers: { ...entry.headers } }) }
}

/** Connect the enabled servers and keep them in step with each saved list. */
export function apply(ctx: Context, config: Config): void {
  const mounted = new Map<string, { key: string; fiber: Fiber }>()
  let applied: unknown
  const reconcile = (): void => {
    const servers = config.servers.get()
    if (servers === applied) return
    applied = servers
    const wanted = new Map<string, { key: string; config: McpClient.Config }>()
    const seen = new Set<string>()
    for (const entry of servers) {
      if (!entry.enabled) continue
      if (seen.has(entry.name)) { ctx.logger.error('user-mcp-servers: skipping duplicate server name %s', entry.name); continue }
      seen.add(entry.name)
      const resolved = mcpClientConfig(entry)
      if ('problem' in resolved) { ctx.logger.error('user-mcp-servers: skipping %s: %s', entry.name || '(unnamed)', resolved.problem); continue }
      // The schema-resolved client config has a fixed field order, so equal entries compare equal.
      wanted.set(entry.name, { key: JSON.stringify(resolved.config), config: resolved.config })
    }
    for (const [serverName, current] of mounted) {
      if (wanted.get(serverName)?.key === current.key) continue
      mounted.delete(serverName)
      void current.fiber.dispose()
    }
    for (const [serverName, next] of wanted) {
      if (mounted.has(serverName)) continue
      mounted.set(serverName, { key: next.key, fiber: ctx.plugin(McpClient, next.config) })
    }
  }
  reconcile()
  ctx.effect(() => {
    const timer = setInterval(reconcile, config.pollIntervalMs)
    return () => { clearInterval(timer) }
  }, 'user-mcp-servers.poll')
}
