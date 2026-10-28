/** Main-process execution of agent browser commands in a Session's right-Sidebar guests. */
import type { DesktopBrowserLeaseId } from '@deepseek-ai/dsh-client-ui-sidebar-browser/types'
import type {
  DesktopBrowserCommand, DesktopBrowserKey, DesktopBrowserRequest, DesktopBrowserResult, DesktopBrowserTab,
} from '@deepseek-ai/dsh-browser-use-desktop/protocol'
import {
  AGENT_WORLD_ID, selectAllScript, scrollScript, snapshotScript, targetScript,
  type AgentPageSnapshot, type AgentPageTarget,
} from './browser-agent-page.ts'

/** Time after an input event in which a page may start the navigation it causes. */
const SETTLE_MS = 400
/** Time the tab keeps its agent mark after a command, so consecutive commands do not flicker it. */
const ACTIVITY_LINGER_MS = 1_500
/** Screenshots wider than this are scaled down to it. */
const SCREENSHOT_MAX_WIDTH = 1_280
const POLL_MS = 100

const KEY_CODES: Readonly<Record<DesktopBrowserKey, { readonly keyCode: string; readonly char?: string }>> = {
  Enter: { keyCode: 'Enter', char: '\r' },
  Escape: { keyCode: 'Escape' },
  Tab: { keyCode: 'Tab' },
  Backspace: { keyCode: 'Backspace' },
  Space: { keyCode: 'Space', char: ' ' },
  ArrowUp: { keyCode: 'Up' },
  ArrowDown: { keyCode: 'Down' },
  ArrowLeft: { keyCode: 'Left' },
  ArrowRight: { keyCode: 'Right' },
  PageUp: { keyCode: 'PageUp' },
  PageDown: { keyCode: 'PageDown' },
  Home: { keyCode: 'Home' },
  End: { keyCode: 'End' },
}

/** Captured page image operations the agent uses; Electron's `NativeImage` provides them. */
export interface AgentGuestImage {
  getSize(): { width: number; height: number }
  resize(options: { width: number; quality: 'good' }): AgentGuestImage
  toPNG(): Buffer
}

/** Guest operations the agent uses; Electron's `WebContents` provides them. */
export interface AgentGuestContents {
  getURL(): string
  getTitle(): string
  isLoading(): boolean
  isDestroyed(): boolean
  getZoomFactor(): number
  loadURL(url: string): Promise<void>
  reload(): void
  readonly navigationHistory: { canGoBack(): boolean; canGoForward(): boolean; goBack(): void; goForward(): void }
  executeJavaScriptInIsolatedWorld(worldId: number, scripts: { code: string }[]): Promise<unknown>
  sendInputEvent(event:
    | { type: 'mouseMove'; x: number; y: number }
    | { type: 'mouseDown' | 'mouseUp'; button: 'left'; clickCount: number; x: number; y: number }
    | { type: 'keyDown' | 'keyUp' | 'char'; keyCode: string }): void
  insertText(text: string): Promise<void>
  capturePage(): Promise<AgentGuestImage>
}

/** One Sidebar guest an agent command may operate. */
export interface AgentGuest {
  readonly tab: string
  readonly lease: DesktopBrowserLeaseId
  readonly guest: AgentGuestContents
}

/** Lease-registry operations the agent uses; `DesktopBrowserGuests` provides them. */
export interface AgentGuestRegistry {
  agentGuests(chatSession: string): readonly AgentGuest[]
  requestAgentOpen(chatSession: string, url: string): boolean
  setAgentActivity(lease: DesktopBrowserLeaseId, active: boolean): void
  isAllowedNavigation(value: string): boolean
}

/** A command failure whose message is written for the model that issued the command. */
export class DesktopBrowserCommandError extends Error {}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason as Error); return }
    const abort = (): void => { clearTimeout(timer); reject(signal.reason as Error) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}

async function until(condition: () => boolean, signal: AbortSignal): Promise<void> {
  while (!condition()) await wait(POLL_MS, signal)
}

function tabInfo(entry: AgentGuest): DesktopBrowserTab {
  return { tab: entry.tab, url: entry.guest.getURL(), title: entry.guest.getTitle(), loading: entry.guest.isLoading() }
}

/** Runs one command at a time per request and marks operated tabs in the owning window. */
export class DesktopBrowserAgent {
  private readonly lingering = new Map<DesktopBrowserLeaseId, ReturnType<typeof setTimeout>>()

  /** @param guests - lease registry that owns the Sidebar guests. */
  constructor(private readonly guests: AgentGuestRegistry) {}

  /**
   * Execute one validated request.
   * @param request - Session, deadline, and command from the Host.
   * @param signal - Host cancellation.
   * @returns the command result; rejects with {@link DesktopBrowserCommandError} for failures the model can act on.
   */
  async execute(request: DesktopBrowserRequest, signal: AbortSignal): Promise<DesktopBrowserResult> {
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(request.timeoutMs)])
    try {
      return await this.run(request.session, request.command, deadline)
    } catch (error) {
      if (deadline.aborted && !signal.aborted && !(error instanceof DesktopBrowserCommandError)) {
        throw new DesktopBrowserCommandError(`the browser did not finish within ${String(request.timeoutMs)} ms; take a snapshot to see the current page`)
      }
      throw error
    }
  }

  /** Clear pending activity marks; the owning windows are closing. */
  dispose(): void {
    for (const timer of this.lingering.values()) clearTimeout(timer)
    this.lingering.clear()
  }

  private async run(session: string, command: DesktopBrowserCommand, signal: AbortSignal): Promise<DesktopBrowserResult> {
    switch (command.action) {
      case 'tabs':
        return { kind: 'tabs', tabs: this.guests.agentGuests(session).map(tabInfo) }
      case 'open': {
        this.assertAllowed(command.url)
        return { kind: 'page', tab: await this.open(session, command.url, signal) }
      }
      case 'navigate': {
        const entry = this.resolve(session, command.tab)
        return this.operate(entry, signal, async () => {
          if (command.url !== undefined) {
            this.assertAllowed(command.url)
            await this.load(entry.guest, command.url)
          } else if (command.history === 'reload') entry.guest.reload()
          else {
            const history = entry.guest.navigationHistory
            const possible = command.history === 'back' ? history.canGoBack() : history.canGoForward()
            if (!possible) throw new DesktopBrowserCommandError(`the tab has no ${String(command.history)} history entry`)
            if (command.history === 'back') history.goBack()
            else history.goForward()
          }
          await this.settle(entry.guest, signal)
        })
      }
      case 'snapshot': {
        const entry = this.resolve(session, command.tab)
        await this.loaded(entry.guest, signal)
        const page = await this.script<AgentPageSnapshot>(entry.guest, snapshotScript(command.maxTextChars, command.maxElements))
        return { kind: 'snapshot', tab: { ...tabInfo(entry), title: page.title || entry.guest.getTitle() },
          text: page.text, textTruncated: page.textTruncated, elements: [...page.elements],
          elementsTruncated: page.elementsTruncated, scroll: page.scroll }
      }
      case 'click': {
        const entry = this.resolve(session, command.tab)
        return this.operate(entry, signal, async () => {
          const target = await this.target(entry.guest, command.ref)
          this.click(entry.guest, target.x, target.y)
          await this.settle(entry.guest, signal)
        })
      }
      case 'type': {
        const entry = this.resolve(session, command.tab)
        return this.operate(entry, signal, async () => {
          const target = await this.target(entry.guest, command.ref)
          if (target.secret) {
            throw new DesktopBrowserCommandError('this is a password or one-time-code field; ask the user to fill it in the browser tab')
          }
          if (!target.editable) throw new DesktopBrowserCommandError(`element ${String(command.ref)} is not a text field`)
          this.click(entry.guest, target.x, target.y)
          if (command.clear) await this.script<boolean>(entry.guest, selectAllScript(command.ref))
          await entry.guest.insertText(command.text)
          if (command.submit) this.key(entry.guest, 'Enter')
          await this.settle(entry.guest, signal)
        })
      }
      case 'press': {
        const entry = this.resolve(session, command.tab)
        return this.operate(entry, signal, async () => {
          this.key(entry.guest, command.key)
          await this.settle(entry.guest, signal)
        })
      }
      case 'scroll': {
        const entry = this.resolve(session, command.tab)
        return this.operate(entry, signal, async () => {
          if (!await this.script<boolean>(entry.guest, scrollScript(command.direction, command.ref))) this.stale(command.ref ?? 0)
          await wait(POLL_MS, signal)
        })
      }
      case 'screenshot': {
        const entry = this.resolve(session, command.tab)
        await this.loaded(entry.guest, signal)
        let image = await entry.guest.capturePage()
        if (image.getSize().width > SCREENSHOT_MAX_WIDTH) image = image.resize({ width: SCREENSHOT_MAX_WIDTH, quality: 'good' })
        const { width, height } = image.getSize()
        if (width === 0 || height === 0) throw new DesktopBrowserCommandError('the tab is not visible, so it cannot be captured; ask the user to show the browser tab')
        return { kind: 'screenshot', tab: tabInfo(entry), png: image.toPNG().toString('base64'), width, height }
      }
    }
  }

  private async open(session: string, url: string, signal: AbortSignal): Promise<DesktopBrowserTab> {
    const before = new Set(this.guests.agentGuests(session).map(entry => entry.tab))
    const created = (): AgentGuest | undefined => this.guests.agentGuests(session).find(entry => !before.has(entry.tab))
    if (!this.guests.requestAgentOpen(session, url)) throw new DesktopBrowserCommandError('the application window is not open')
    try {
      await until(() => created() !== undefined, signal)
    } catch (error) {
      if (signal.aborted) throw new DesktopBrowserCommandError('no browser tab opened; the chat must be on screen in the application window for its browser tabs to open')
      throw error
    }
    const entry = created() as AgentGuest
    this.mark(entry.lease)
    try {
      await until(() => !entry.guest.isDestroyed() && !entry.guest.getURL().startsWith('about:blank') && !entry.guest.isLoading(), signal)
    } finally { this.unmark(entry.lease) }
    return tabInfo(entry)
  }

  private async operate(entry: AgentGuest, signal: AbortSignal, body: () => Promise<void>): Promise<DesktopBrowserResult> {
    this.mark(entry.lease)
    try {
      await this.loaded(entry.guest, signal)
      await body()
    } finally { this.unmark(entry.lease) }
    return { kind: 'page', tab: tabInfo(entry) }
  }

  private resolve(session: string, tab: string | undefined): AgentGuest {
    const entries = this.guests.agentGuests(session)
    if (entries.length === 0) throw new DesktopBrowserCommandError('no browser tab is open in this chat; use browser_open')
    const entry = tab === undefined ? entries.at(-1) : entries.find(candidate => candidate.tab === tab)
    if (entry === undefined) throw new DesktopBrowserCommandError(`tab "${String(tab)}" is not open; call browser_tabs for the current tabs`)
    return entry
  }

  private assertAllowed(url: string): void {
    if (!this.guests.isAllowedNavigation(url)) {
      throw new DesktopBrowserCommandError('only absolute http:// and https:// addresses without credentials can be opened, and not the application itself')
    }
  }

  private async load(guest: AgentGuestContents, url: string): Promise<void> {
    try {
      await guest.loadURL(url)
    } catch (error) {
      // A redirect or a later navigation aborts the first load; the page state is reported afterwards.
      if (error instanceof Error && 'code' in error && error.code === 'ERR_ABORTED') return
      throw new DesktopBrowserCommandError(`the page failed to load: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async loaded(guest: AgentGuestContents, signal: AbortSignal): Promise<void> {
    await until(() => guest.isDestroyed() || !guest.isLoading(), signal)
    if (guest.isDestroyed()) throw new DesktopBrowserCommandError('the tab was closed')
  }

  private async settle(guest: AgentGuestContents, signal: AbortSignal): Promise<void> {
    await wait(SETTLE_MS, signal)
    await this.loaded(guest, signal)
  }

  private async script<T>(guest: AgentGuestContents, code: string): Promise<T> {
    return await guest.executeJavaScriptInIsolatedWorld(AGENT_WORLD_ID, [{ code }]) as T
  }

  private async target(guest: AgentGuestContents, ref: number): Promise<Extract<AgentPageTarget, { found: true }>> {
    const target = await this.script<AgentPageTarget>(guest, targetScript(ref))
    if (!target.found) this.stale(ref)
    return target
  }

  private stale(ref: number): never {
    throw new DesktopBrowserCommandError(`element ${String(ref)} is not on the current page; take a new snapshot`)
  }

  private click(guest: AgentGuestContents, x: number, y: number): void {
    const zoom = guest.getZoomFactor()
    const point = { x: Math.round(x * zoom), y: Math.round(y * zoom) }
    guest.sendInputEvent({ type: 'mouseMove', ...point })
    guest.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
    guest.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
  }

  private key(guest: AgentGuestContents, key: DesktopBrowserKey): void {
    const { keyCode, char } = KEY_CODES[key]
    guest.sendInputEvent({ type: 'keyDown', keyCode })
    if (char !== undefined) guest.sendInputEvent({ type: 'char', keyCode: char })
    guest.sendInputEvent({ type: 'keyUp', keyCode })
  }

  private mark(lease: DesktopBrowserLeaseId): void {
    const timer = this.lingering.get(lease)
    if (timer !== undefined) clearTimeout(timer)
    this.lingering.delete(lease)
    this.guests.setAgentActivity(lease, true)
  }

  private unmark(lease: DesktopBrowserLeaseId): void {
    this.lingering.set(lease, setTimeout(() => {
      this.lingering.delete(lease)
      this.guests.setAgentActivity(lease, false)
    }, ACTIVITY_LINGER_MS))
  }
}
