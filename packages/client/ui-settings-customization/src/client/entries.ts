/** Pure conversions between the pages' text controls and the stored server and skill lists. */

import type { McpServerEntry, UserSkillEntry } from './controllers.ts'

const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/u
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/**
 * A blank server, as "Add server" appends it.
 * @returns an enabled stdio entry with empty fields.
 */
export const emptyServer = (): McpServerEntry => ({
  name: '', enabled: true, transport: 'stdio', command: '', args: [], env: {}, url: '', headers: {},
})

/**
 * A blank skill, as "Add skill" appends it.
 * @returns an enabled entry with empty fields.
 */
export const emptySkill = (): UserSkillEntry => ({ name: '', enabled: true, description: '', content: '' })

/**
 * Whether a server name is valid and unique in its list.
 * @param servers - the whole list.
 * @param index - the entry checked.
 * @returns true when the entry's name can connect.
 */
export function serverNameValid(servers: readonly McpServerEntry[], index: number): boolean {
  const name = servers[index]?.name ?? ''
  return SERVER_NAME.test(name) && servers.findIndex(server => server.name === name) === index
}

/**
 * Whether a skill name is valid and unique in its list.
 * @param skills - the whole list.
 * @param index - the entry checked.
 * @returns true when the entry's name can register.
 */
export function skillNameValid(skills: readonly UserSkillEntry[], index: number): boolean {
  const name = skills[index]?.name ?? ''
  return SKILL_NAME.test(name) && skills.findIndex(skill => skill.name === name) === index
}

/**
 * Split one-per-line text into non-empty trimmed lines.
 * @param text - the control's text.
 * @returns the lines.
 */
export function linesOf(text: string): string[] {
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
}

/**
 * Parse `NAME=value` or `Name: value` lines into a record; a line without the separator is ignored.
 * @param text - the control's text.
 * @param separator - `=` for environment variables, `:` for headers.
 * @returns the pairs.
 */
export function pairsOf(text: string, separator: '=' | ':'): Record<string, string> {
  const pairs: Record<string, string> = {}
  for (const line of linesOf(text)) {
    const at = line.indexOf(separator)
    if (at <= 0) continue
    pairs[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return pairs
}

/**
 * Render a record as the lines {@link pairsOf} reads back.
 * @param pairs - the stored pairs.
 * @param separator - `=` for environment variables, `:` for headers.
 * @returns one pair per line.
 */
export function pairsText(pairs: Readonly<Record<string, string>>, separator: '=' | ':'): string {
  return Object.entries(pairs).map(([key, value]) => separator === '=' ? `${key}=${value}` : `${key}: ${value}`).join('\n')
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringRecord = (value: unknown): Record<string, string> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'string')) as Record<string, string> : {}

/**
 * Read servers from the `mcpServers` JSON that MCP server documentation publishes.
 * Accepts the wrapper object or the bare name-to-server map.
 * @param text - the pasted JSON.
 * @returns the servers in source order, or undefined when the text is not such a configuration.
 */
export function importMcpServers(text: string): McpServerEntry[] | undefined {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch {
    // The caller shows the "not an mcpServers configuration" message.
    return undefined
  }
  const map = isRecord(parsed) && isRecord(parsed.mcpServers) ? parsed.mcpServers : parsed
  if (!isRecord(map)) return undefined
  const servers: McpServerEntry[] = []
  for (const [name, value] of Object.entries(map)) {
    if (!isRecord(value)) return undefined
    const url = typeof value.url === 'string' ? value.url : typeof value.serverUrl === 'string' ? value.serverUrl : undefined
    if (url !== undefined) {
      servers.push({ ...emptyServer(), name, transport: 'streamable-http', url, headers: stringRecord(value.headers), enabled: value.disabled !== true })
    } else if (typeof value.command === 'string') {
      const args = Array.isArray(value.args) ? value.args.filter((item): item is string => typeof item === 'string') : []
      servers.push({ ...emptyServer(), name, command: value.command, args, env: stringRecord(value.env), enabled: value.disabled !== true })
    } else {
      return undefined
    }
  }
  return servers.length > 0 ? servers : undefined
}

/**
 * Merge imported servers into a list: an imported name replaces the same-named entry in place.
 * @param current - the staged list.
 * @param imported - servers read from JSON.
 * @returns the merged list.
 */
export function mergeServers(current: readonly McpServerEntry[], imported: readonly McpServerEntry[]): McpServerEntry[] {
  const merged = [...current]
  for (const server of imported) {
    const at = merged.findIndex(entry => entry.name === server.name)
    if (at === -1) merged.push(server)
    else merged[at] = server
  }
  return merged
}

/**
 * Read a staged list field's JSON text.
 * @param text - the field text.
 * @returns the list, or an empty list for text that is not a JSON array.
 */
export function listOf<T>(text: string): T[] {
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value) ? value as T[] : []
  } catch {
    // An unparseable draft cannot be produced by the editors; render it as empty.
    return []
  }
}
