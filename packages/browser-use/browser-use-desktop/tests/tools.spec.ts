/** Desktop browser tools through real Agent, Session, and tool services with a recorded channel. */
import { executeToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit'
import BrowserUseRegistry from '@deepseek-ai/dsh-browser-use'
import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as Provider from '../src/index.ts'
import { rootAgent, snapshotText } from '../src/index.ts'
import type { DesktopBrowserChannelRequest } from '../src/index.ts'
import { desktopBrowserCommandSchema, desktopBrowserResponseSchema } from '../src/protocol.ts'
import type { DesktopBrowserResult } from '../src/protocol.ts'

class SilentModel extends LlmAdapter {
  async * stream(): AsyncIterable<StreamChunk> { throw new Error('the browser tools called the Session model') }
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, ...model === 'vision' ? { inputModalities: ['text', 'image'] } : {} })
  }
}

/** A 1x1 PNG. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const tab = { tab: 'tab-1', url: 'https://www.ozon.ru/', title: 'OZON', loading: false }
let ctx: Context
let agent: Agent
let vision: Agent
let home: string
let store: ReturnType<Context['plugin']>
let requests: DesktopBrowserChannelRequest[]
let answer: (request: DesktopBrowserChannelRequest) => Promise<DesktopBrowserResult>

beforeEach(async () => {
  requests = []
  answer = async () => ({ kind: 'page', tab })
  ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(BrowserUseRegistry)
  ctx.llm.registerAdapter(['fixture'], new SilentModel())
  home = await mkdtemp(join(tmpdir(), 'dsh-browser-desktop-'))
  store = ctx.plugin(LocalAttachmentStore, { dshHome: home })
  await store
  const harness = await mountAgentLoopTestHarness(ctx)
  agent = await harness.create(SessionId('browser-chat'), { provider: 'fixture', model: 'structured' })
  vision = await harness.create(SessionId('vision-chat'), { provider: 'fixture', model: 'vision' })
})

afterEach(async () => {
  await ctx.fiber.dispose()
  await rm(home, { recursive: true, force: true })
})

function mount(limits: Partial<Provider.Config> = {}) {
  return ctx.plugin(Provider, {
    channel: async (request) => { requests.push(request); return answer(request) },
    ...limits,
  })
}

function execute(name: string, args: unknown, caller: Agent | null = agent) {
  return executeToolFixture(ctx, {
    ...caller === null ? {} : { agent: caller },
    name, arguments: args, callId: ToolCallId(`call-${name}`), signal: new AbortController().signal,
  })
}

it('registers the browser tools for one provider and removes them with the plugin', async () => {
  const provider = mount()
  await provider
  expect(ctx.browserUse.providerName).toBe('desktop')
  expect(ctx.tools.schemas().map(tool => tool.name).sort()).toEqual([
    'browser_click', 'browser_navigate', 'browser_open', 'browser_press', 'browser_screenshot',
    'browser_scroll', 'browser_snapshot', 'browser_tabs', 'browser_type',
  ])
  await provider.dispose()
  expect(ctx.tools.schemas()).toEqual([])
  expect(ctx.browserUse.providerName).toBeUndefined()
})

it('sends commands for the calling chat with the configured deadline', async () => {
  await mount({ operationTimeoutMs: 12_000 })
  const opened = await execute('browser_open', { url: 'https://www.ozon.ru/' })
  expect(opened.isError).toBe(false)
  expect(opened.content).toEqual([{ type: 'text', text: 'Tab tab-1: OZON <https://www.ozon.ru/>' }])
  await execute('browser_type', { ref: 4, text: 'наушники' })
  await execute('browser_type', { tab: 'tab-1', ref: 4, text: 'чехол', clear: false, submit: true })
  await execute('browser_navigate', { history: 'back' })
  expect(requests).toEqual([
    { session: 'browser-chat', timeoutMs: 12_000, command: { action: 'open', url: 'https://www.ozon.ru/' } },
    { session: 'browser-chat', timeoutMs: 12_000, command: { action: 'type', ref: 4, text: 'наушники', clear: true, submit: false } },
    { session: 'browser-chat', timeoutMs: 12_000, command: { action: 'type', tab: 'tab-1', ref: 4, text: 'чехол', clear: false, submit: true } },
    { session: 'browser-chat', timeoutMs: 12_000, command: { action: 'navigate', history: 'back' } },
  ])
})

it('passes snapshot limits and lists elements by ref before the page text', async () => {
  await mount({ snapshotTextChars: 500, snapshotElements: 20 })
  answer = async () => ({
    kind: 'snapshot', tab, text: 'Наушники\nВ корзину', textTruncated: true,
    elements: [
      { ref: 1, role: 'searchbox', name: 'Искать на Ozon', value: '', inView: true },
      { ref: 2, role: 'button', name: 'В корзину', disabled: true, inView: false },
    ],
    elementsTruncated: false, scroll: { top: 0, height: 4000, viewport: 800 },
  })
  const result = await execute('browser_snapshot', {})
  expect(requests[0]?.command).toEqual({ action: 'snapshot', maxTextChars: 500, maxElements: 20 })
  expect(result.content).toEqual([{ type: 'text', text: [
    'Tab tab-1: OZON <https://www.ozon.ru/>',
    'Scroll: 0 of 4000 px, viewport 800 px',
    '',
    'Interactive elements:',
    '[1] searchbox "Искать на Ozon" value=""',
    '[2] button "В корзину" disabled offscreen',
    '',
    'Page text (truncated):',
    'Наушники\nВ корзину',
  ].join('\n') }])
})

it('reports channel failures and agentless calls as tool errors', async () => {
  await mount()
  answer = async () => { throw new Error('element 9 is not on the current page; take a new snapshot') }
  const failed = await execute('browser_click', { ref: 9 })
  expect(failed.isError).toBe(true)
  expect(JSON.stringify(failed.content)).toContain('take a new snapshot')
  const agentless = await execute('browser_tabs', {}, null)
  expect(agentless.isError).toBe(true)
  expect(requests).toHaveLength(1)
})

it('refuses a screenshot before contacting the browser without an image-capable model route', async () => {
  await mount()
  const result = await execute('browser_screenshot', {})
  expect(result.isError).toBe(true)
  expect(JSON.stringify(result.content)).toContain('does not accept images; use browser_snapshot')
  const agentless = await execute('browser_screenshot', {}, null)
  expect(JSON.stringify(agentless.content)).toContain('the current model route could not be resolved')
  expect(requests).toEqual([])
})

it('renders the tab list, or the next step when it is empty', async () => {
  await mount()
  answer = async () => ({ kind: 'tabs', tabs: [] })
  expect((await execute('browser_tabs', {})).content).toEqual([
    { type: 'text', text: 'No browser tabs are open in this chat. Use browser_open to open one.' },
  ])
  answer = async () => ({ kind: 'tabs', tabs: [tab, { ...tab, tab: 'tab-2' }] })
  expect((await execute('browser_tabs', {})).content).toEqual([
    { type: 'text', text: 'Tab tab-1: OZON <https://www.ozon.ru/>\nTab tab-2: OZON <https://www.ozon.ru/>' },
  ])
})

it('refuses a screenshot without an attachment store', async () => {
  await mount()
  await store.dispose()
  const result = await execute('browser_screenshot', {}, vision)
  expect(JSON.stringify(result.content)).toContain('screenshots require an attachment store')
  expect(requests).toEqual([])
})

it('resolves delegated Agents to the chat of their top-level creator', () => {
  const root = { id: 'root' } as Agent
  const child = { id: 'child' } as Agent
  const grandchild = { id: 'grandchild' } as Agent
  const owners = new Map<Agent, Agent>([[child, root], [grandchild, child]])
  const agents = {
    list: () => [root, child, grandchild],
    isOwnedBy: (id: string, owner: Agent) => [...owners].some(([entry, parent]) => entry.id === id && parent === owner),
  }
  expect(rootAgent(agents, grandchild)).toBe(root)
  expect(rootAgent(agents, root)).toBe(root)
})

it('parses only well-formed process messages', () => {
  expect(desktopBrowserCommandSchema.safeParse({ action: 'navigate', url: 'https://a.example/', history: 'back' }).success).toBe(false)
  expect(desktopBrowserCommandSchema.safeParse({ action: 'navigate' }).success).toBe(false)
  expect(desktopBrowserCommandSchema.safeParse({ action: 'press', key: 'F5' }).success).toBe(false)
  expect(desktopBrowserCommandSchema.safeParse({ action: 'click', ref: 0 }).success).toBe(false)
  expect(desktopBrowserResponseSchema.safeParse({ type: 'browser-result', requestId: 1, error: 'x' }).success).toBe(true)
  expect(desktopBrowserResponseSchema.safeParse({ type: 'browser-result', requestId: 1, result: { kind: 'page' } }).success).toBe(false)
  expect(snapshotText({ tab, text: '', textTruncated: false, elements: [], elementsTruncated: true, scroll: { top: 1.4, height: 2, viewport: 3 } }))
    .toContain('Interactive elements (truncated; scroll or narrow the page to see more):\n(none)')
})

it('stores a screenshot for an image-capable model and returns the image block', async () => {
  await mount()
  answer = async () => ({ kind: 'screenshot', tab: { ...tab, title: '', loading: true }, png: PNG, width: 1, height: 1 })
  const result = await execute('browser_screenshot', { tab: 'tab-1' }, vision)
  expect(result.isError).toBe(false)
  expect(requests[0]).toEqual({ session: 'vision-chat', timeoutMs: 30_000, command: { action: 'screenshot', tab: 'tab-1' } })
  expect(result.content[0]).toEqual({ type: 'text', text: 'Screenshot, 1x1 px. Tab tab-1 (loading): (untitled) <https://www.ozon.ru/>' })
  expect(result.content[1]).toMatchObject({ type: 'image', attachment: { mediaType: 'image/png', width: 1, height: 1 } })
})

it('rejects an answer of the wrong kind for every result shape', async () => {
  await mount()
  answer = async () => ({ kind: 'tabs', tabs: [] })
  for (const [name, args] of [['browser_click', { ref: 1 }], ['browser_snapshot', {}], ['browser_screenshot', {}]] as const) {
    const result = await execute(name, args, vision)
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('browser returned tabs')
  }
  answer = async () => ({ kind: 'page', tab })
  expect(JSON.stringify((await execute('browser_tabs', {})).content)).toContain('browser returned page for tabs')
})

it('forwards every tool argument and titles every call', async () => {
  await mount()
  await execute('browser_navigate', { tab: 'tab-2', url: 'https://www.ozon.ru/cart' })
  await execute('browser_snapshot', { tab: 'tab-2' })
  await execute('browser_click', { tab: 'tab-2', ref: 3 })
  await execute('browser_press', { key: 'Enter' })
  await execute('browser_press', { tab: 'tab-2', key: 'Escape' })
  await execute('browser_scroll', { direction: 'down' })
  await execute('browser_scroll', { tab: 'tab-2', direction: 'up', ref: 8 })
  expect(requests.map(request => request.command)).toEqual([
    { action: 'navigate', tab: 'tab-2', url: 'https://www.ozon.ru/cart' },
    { action: 'snapshot', tab: 'tab-2', maxTextChars: 6_000, maxElements: 150 },
    { action: 'click', tab: 'tab-2', ref: 3 },
    { action: 'press', key: 'Enter' },
    { action: 'press', tab: 'tab-2', key: 'Escape' },
    { action: 'scroll', direction: 'down' },
    { action: 'scroll', tab: 'tab-2', direction: 'up', ref: 8 },
  ])
  const titles = Object.fromEntries([
    ['browser_tabs', {}], ['browser_open', { url: 'https://www.ozon.ru/' }], ['browser_navigate', { history: 'reload' }],
    ['browser_snapshot', {}], ['browser_click', { ref: 2 }], ['browser_type', { ref: 2, text: 'наушники' }],
    ['browser_press', { key: 'Tab' }], ['browser_scroll', { direction: 'up' }], ['browser_screenshot', {}],
  ].map(([name, args]): [string, unknown] => [name as string, ctx.tools.get(name as string)?.presentCall?.(args)]))
  expect(['browser_snapshot', 'browser_screenshot', 'browser_click'].map(name => ctx.tools.get(name)?.isConcurrencySafe?.({}) ?? false))
    .toEqual([true, true, false])
  expect(titles).toEqual({
    browser_tabs: { card: 'generic', title: 'Browser tabs', kind: 'fetch' },
    browser_open: { card: 'generic', title: 'Open page: https://www.ozon.ru/', kind: 'fetch' },
    browser_navigate: { card: 'generic', title: 'Navigate: reload', kind: 'fetch' },
    browser_snapshot: { card: 'generic', title: 'Read page', kind: 'fetch' },
    browser_click: { card: 'generic', title: 'Click: #2', kind: 'fetch' },
    browser_type: { card: 'generic', title: 'Type: наушники', kind: 'fetch' },
    browser_press: { card: 'generic', title: 'Press: Tab', kind: 'fetch' },
    browser_scroll: { card: 'generic', title: 'Scroll: up', kind: 'fetch' },
    browser_screenshot: { card: 'generic', title: 'Screenshot', kind: 'fetch' },
  })
})

it('stops resolving at a cycle of owners', () => {
  const left = { id: 'left' } as Agent
  const right = { id: 'right' } as Agent
  const agents = { list: () => [left, right], isOwnedBy: (id: string, owner: Agent) => owner === (id === 'left' ? right : left) }
  expect([left, right]).toContain(rootAgent(agents, left))
})

it('renders checked, unchecked, and untitled entries', () => {
  expect(snapshotText({
    tab: { ...tab, title: '' }, text: 'x', textTruncated: false, elementsTruncated: false, scroll: { top: 0, height: 1, viewport: 1 },
    elements: [
      { ref: 1, role: 'checkbox', name: 'A', checked: true, inView: true },
      { ref: 2, role: 'radio', name: 'B', checked: false, inView: true },
      { ref: 3, role: 'link', name: 'C', inView: true },
    ],
  })).toContain('Tab tab-1: (untitled) <https://www.ozon.ru/>\nScroll: 0 of 1 px, viewport 1 px\n\nInteractive elements:\n[1] checkbox "A" checked\n[2] radio "B" unchecked\n[3] link "C"\n')
})
