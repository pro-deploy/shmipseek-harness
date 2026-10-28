/** Agent browser commands against recorded guest operations; the page scripts are covered by their own spec. */
import { afterEach, expect, it, vi } from 'vitest'
import type { DesktopBrowserLeaseId } from '@deepseek-ai/dsh-client-ui-sidebar-browser/types'
import type { DesktopBrowserCommand, DesktopBrowserRequest } from '@deepseek-ai/dsh-browser-use-desktop/protocol'
import { DesktopBrowserAgent } from '../src/browser-agent.ts'
import type { AgentGuest, AgentGuestContents, AgentGuestImage, AgentGuestRegistry } from '../src/browser-agent.ts'
import { AGENT_WORLD_ID } from '../src/browser-agent-page.ts'

interface FakeGuest {
  url: string
  title: string
  loading: boolean
  zoom: number
  scripts: string[]
  inputs: unknown[]
  inserted: string[]
  answers: Record<string, unknown>
  image: { width: number; height: number }
  back: boolean
}

type FakeContents = AgentGuestContents & { loadURL: ReturnType<typeof vi.fn> }

function guest(fields: Partial<FakeGuest> = {}): { state: FakeGuest; contents: FakeContents } {
  const state: FakeGuest = {
    url: 'https://www.ozon.ru/', title: 'OZON', loading: false, zoom: 1, scripts: [], inputs: [], inserted: [],
    answers: {}, image: { width: 800, height: 600 }, back: true, ...fields,
  }
  const image = (width: number, height: number): AgentGuestImage => ({
    getSize: () => ({ width, height }),
    resize: ({ width: next }: { width: number }) => image(next, Math.round(height * next / width)),
    toPNG: () => Buffer.from(`png:${String(width)}x${String(height)}`),
  })
  const contents = {
    getURL: () => state.url,
    getTitle: () => state.title,
    isLoading: () => state.loading,
    isDestroyed: () => false,
    getZoomFactor: () => state.zoom,
    loadURL: vi.fn(async (url: string) => { state.url = url }),
    reload: vi.fn(),
    navigationHistory: { canGoBack: () => state.back, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
    executeJavaScriptInIsolatedWorld: vi.fn(async (world: number, scripts: { code: string }[]) => {
      expect(world).toBe(AGENT_WORLD_ID)
      const code = scripts[0]?.code ?? ''
      state.scripts.push(code)
      const key = Object.keys(state.answers).find(marker => code.includes(marker))
      return key === undefined ? true : state.answers[key]
    }),
    sendInputEvent: vi.fn((event: unknown) => { state.inputs.push(event) }),
    insertText: vi.fn(async (text: string) => { state.inserted.push(text) }),
    capturePage: vi.fn(async () => image(state.image.width, state.image.height)),
  }
  return { state, contents }
}

function registry(entries: AgentGuest[] = []) {
  const activity: [DesktopBrowserLeaseId, boolean][] = []
  const opened: [string, string][] = []
  const guests: AgentGuestRegistry = {
    agentGuests: (session: string) => session === 'chat' ? [...entries] : [],
    requestAgentOpen: (session: string, url: string) => { opened.push([session, url]); return true },
    setAgentActivity: (lease: DesktopBrowserLeaseId, active: boolean) => { activity.push([lease, active]) },
    isAllowedNavigation: (url: string) => url.startsWith('https://'),
  }
  return { guests, activity, opened, agent: new DesktopBrowserAgent(guests) }
}

const lease = 'lease-1' as DesktopBrowserLeaseId
const agents: DesktopBrowserAgent[] = []
afterEach(() => {
  for (const agent of agents.splice(0)) agent.dispose()
  vi.useRealTimers()
})

function request(command: DesktopBrowserCommand, timeoutMs = 5_000): DesktopBrowserRequest {
  return { type: 'browser-command', requestId: 1, session: 'chat', timeoutMs, command }
}

function setup(fields?: Partial<FakeGuest>) {
  const page = guest(fields)
  const h = registry([{ tab: 'tab-1', lease, guest: page.contents }])
  agents.push(h.agent)
  return { ...h, page }
}

const run = (h: ReturnType<typeof setup>, command: DesktopBrowserCommand) => h.agent.execute(request(command), new AbortController().signal)

it('lists only the tabs of the requesting chat', async () => {
  const h = setup()
  expect(await run(h, { action: 'tabs' })).toEqual({ kind: 'tabs', tabs: [{ tab: 'tab-1', url: 'https://www.ozon.ru/', title: 'OZON', loading: false }] })
  expect(await h.agent.execute({ ...request({ action: 'tabs' }), session: 'other' }, new AbortController().signal)).toEqual({ kind: 'tabs', tabs: [] })
})

it('clicks the element center scaled by the page zoom and marks the tab while it works', async () => {
  const h = setup({ zoom: 1.5, answers: { 'state.byRef.get(7)': { found: true, x: 100, y: 40, editable: false, secret: false } } })
  const result = await run(h, { action: 'click', ref: 7 })
  expect(result).toMatchObject({ kind: 'page', tab: { tab: 'tab-1' } })
  expect(h.page.state.inputs).toEqual([
    { type: 'mouseMove', x: 150, y: 60 },
    { type: 'mouseDown', button: 'left', clickCount: 1, x: 150, y: 60 },
    { type: 'mouseUp', button: 'left', clickCount: 1, x: 150, y: 60 },
  ])
  expect(h.activity).toEqual([[lease, true]])
})

it('clears the activity mark after the linger period', async () => {
  vi.useFakeTimers()
  const h = setup()
  const scrolled = run(h, { action: 'scroll', direction: 'down' })
  await vi.advanceTimersByTimeAsync(200)
  await scrolled
  await vi.advanceTimersByTimeAsync(1_500)
  expect(h.activity).toEqual([[lease, true], [lease, false]])
})

it('refuses password and one-time-code fields without input', async () => {
  const h = setup({ answers: { 'state.byRef.get(3)': { found: true, x: 1, y: 1, editable: true, secret: true } } })
  await expect(run(h, { action: 'type', ref: 3, text: 'secret', clear: true, submit: false }))
    .rejects.toThrow('ask the user to fill it in the browser tab')
  expect(h.page.state.inputs).toEqual([])
  expect(h.page.state.inserted).toEqual([])
})

it('focuses a field, replaces its value, and submits with Enter', async () => {
  const h = setup({ answers: { 'state.byRef.get(4)': { found: true, x: 10, y: 20, editable: true, secret: false } } })
  await run(h, { action: 'type', ref: 4, text: 'наушники', clear: true, submit: true })
  expect(h.page.state.scripts.some(code => code.includes('el.select()'))).toBe(true)
  expect(h.page.state.inserted).toEqual(['наушники'])
  expect(h.page.state.inputs.slice(3)).toEqual([
    { type: 'keyDown', keyCode: 'Enter' }, { type: 'char', keyCode: '\r' }, { type: 'keyUp', keyCode: 'Enter' },
  ])
})

it('reports a stale ref and a non-text target', async () => {
  const h = setup({ answers: { 'state.byRef.get(5)': { found: false }, 'state.byRef.get(6)': { found: true, x: 1, y: 1, editable: false, secret: false } } })
  await expect(run(h, { action: 'click', ref: 5 })).rejects.toThrow('element 5 is not on the current page; take a new snapshot')
  await expect(run(h, { action: 'type', ref: 6, text: 'x', clear: false, submit: false })).rejects.toThrow('element 6 is not a text field')
})

it('rejects disallowed addresses, unknown tabs, and missing history', async () => {
  const h = setup({ back: false })
  await expect(run(h, { action: 'navigate', url: 'file:///etc/passwd' })).rejects.toThrow('only absolute http:// and https://')
  await expect(run(h, { action: 'snapshot', tab: 'tab-9', maxTextChars: 10, maxElements: 10 })).rejects.toThrow('tab "tab-9" is not open')
  await expect(run(h, { action: 'navigate', history: 'back' })).rejects.toThrow('the tab has no back history entry')
  const empty = registry()
  agents.push(empty.agent)
  await expect(empty.agent.execute(request({ action: 'screenshot' }), new AbortController().signal)).rejects.toThrow('no browser tab is open in this chat')
})

it('loads an address in an existing tab and reads the page', async () => {
  const h = setup({ answers: { 'const SELECTOR': { title: 'Наушники', text: 'Каталог', textTruncated: false, elements: [], elementsTruncated: false, scroll: { top: 0, height: 10, viewport: 5 } } } })
  await run(h, { action: 'navigate', url: 'https://www.ozon.ru/search/?text=x' })
  expect(h.page.contents.loadURL).toHaveBeenCalledWith('https://www.ozon.ru/search/?text=x')
  const snapshot = await run(h, { action: 'snapshot', maxTextChars: 100, maxElements: 5 })
  expect(snapshot).toMatchObject({ kind: 'snapshot', tab: { title: 'Наушники', url: 'https://www.ozon.ru/search/?text=x' }, text: 'Каталог' })
  expect(h.page.state.scripts.at(-1)).toContain('text.slice(0, 100)')
})

it('opens a tab in the requesting chat and waits for its page', async () => {
  const page = guest({ url: 'about:blank#lease-2', loading: true })
  const entries: AgentGuest[] = []
  const h = registry(entries)
  agents.push(h.agent)
  const opened = h.agent.execute(request({ action: 'open', url: 'https://www.ozon.ru/' }), new AbortController().signal)
  await vi.waitFor(() => { expect(h.opened).toEqual([['chat', 'https://www.ozon.ru/']]) })
  entries.push({ tab: 'tab-2', lease: 'lease-2' as DesktopBrowserLeaseId, guest: page.contents })
  page.state.url = 'https://www.ozon.ru/'
  page.state.loading = false
  expect(await opened).toEqual({ kind: 'page', tab: { tab: 'tab-2', url: 'https://www.ozon.ru/', title: 'OZON', loading: false } })
})

it('explains a tab that never opens within the deadline', async () => {
  const h = registry()
  agents.push(h.agent)
  await expect(h.agent.execute(request({ action: 'open', url: 'https://www.ozon.ru/' }, 300), new AbortController().signal))
    .rejects.toThrow('the chat must be on screen')
})

it('scales wide screenshots down and refuses a hidden tab', async () => {
  const h = setup({ image: { width: 2560, height: 1600 } })
  expect(await run(h, { action: 'screenshot' })).toMatchObject({
    kind: 'screenshot', width: 1280, height: 800, png: Buffer.from('png:1280x800').toString('base64'),
  })
  h.page.state.image = { width: 0, height: 0 }
  await expect(run(h, { action: 'screenshot' })).rejects.toThrow('the tab is not visible')
})

it('names the deadline when the page keeps loading', async () => {
  const h = setup({ loading: true })
  await expect(h.agent.execute(request({ action: 'press', key: 'Escape' }, 250), new AbortController().signal))
    .rejects.toThrow('the browser did not finish within 250 ms')
})
