/** Main-process ownership and fixed isolation policy for Sidebar webview guests. */
import { randomUUID } from 'node:crypto'
import { app, session, type BrowserWindow, type Session, type WebContents } from 'electron'
import type {
  DesktopBrowserAgentActivity, DesktopBrowserAgentOpenRequest, DesktopBrowserLeaseId, DesktopBrowserOpenRequest, DesktopBrowserReservation,
} from '@deepseek-ai/dsh-client-ui-sidebar-browser/types'
import { DESKTOP_IPC } from './ipc.ts'

interface GuestLease {
  readonly owner: WebContents
  readonly partition: string
  /** Chat Session whose right Sidebar holds the tab. */
  readonly session: string
  /** Short id agent commands use for this tab. */
  readonly agentTab: string
  attached: boolean
  guest?: WebContents
  releaseInput?: () => void
}

/** One attached Sidebar guest that agent commands of its Session may operate. */
export interface DesktopAgentGuest {
  readonly tab: string
  readonly lease: DesktopBrowserLeaseId
  readonly guest: WebContents
}

/** Owns workspace storage partitions independently from individual tab guests. */
export class DesktopBrowserGuests {
  private readonly partitions = new Map<string, string>()
  private readonly leases = new Map<DesktopBrowserLeaseId, GuestLease>()
  private readonly owners = new Set<WebContents>()
  private readonly readyListeners = new Set<(session: string) => void>()
  private nextAgentTab = 1

  /** @param hostUrl - current authenticated DSH Host, which guests cannot request. */
  constructor(private readonly hostUrl: () => string | undefined) {}

  /**
   * Reserve one guest in a workspace's process-lifetime partition.
   * @param owner - authenticated primary application WebContents.
   * @param workspace - workspace identity received over IPC.
   * @param chatSession - Session identity of the tab's right Sidebar, received over IPC.
   * @returns opaque lease and the partition approved for it.
   */
  acquire(owner: WebContents, workspace: unknown, chatSession: unknown): DesktopBrowserReservation {
    if (typeof workspace !== 'string' || workspace.length === 0 || workspace.length > 4096) {
      throw new Error('desktop browser: a workspace storage identity is required')
    }
    if (typeof chatSession !== 'string' || chatSession.length === 0 || chatSession.length > 4096) {
      throw new Error('desktop browser: a Session identity is required')
    }
    let partition = this.partitions.get(workspace)
    if (partition === undefined) {
      partition = `dsh-sidebar-browser-${randomUUID()}`
      this.configureSession(session.fromPartition(partition))
      this.partitions.set(workspace, partition)
    }
    const lease = randomUUID() as DesktopBrowserLeaseId
    this.leases.set(lease, { owner, partition, session: chatSession, agentTab: `tab-${String(this.nextAgentTab++)}`, attached: false })
    return { lease, partition }
  }

  /**
   * Release only a lease issued to this application window; workspace storage survives.
   * @param owner - authenticated IPC sender.
   * @param id - lease received over IPC.
   */
  async release(owner: WebContents, id: unknown): Promise<void> {
    if (typeof id !== 'string') throw new Error('desktop browser: invalid guest lease')
    const key = id as DesktopBrowserLeaseId
    const lease = this.leases.get(key)
    if (lease === undefined) return
    if (lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    lease.releaseInput?.()
    this.leases.delete(key)
    const guest = lease.guest
    if (guest !== undefined && !guest.isDestroyed()) {
      const destroyed = new Promise<void>((resolve) => { guest.once('destroyed', resolve) })
      guest.close({ waitForBeforeUnload: false })
      await destroyed
    }
  }

  /**
   * Install attachment checks before the application document can create a webview.
   * @param window - primary application window.
   * @param attachInput - attaches native input after guest ownership is verified and returns its disposer.
   */
  bind(window: BrowserWindow, attachInput: (guest: WebContents, name: DesktopBrowserLeaseId) => () => void): void {
    const owner = window.webContents
    this.owners.add(owner)
    owner.once('destroyed', () => { this.owners.delete(owner) })
    owner.on('will-attach-webview', (event, preferences, params) => {
      const id = typeof params.src === 'string' && params.src.startsWith('about:blank#')
        ? params.src.slice('about:blank#'.length) : ''
      const lease = this.leases.get(id as DesktopBrowserLeaseId)
      if (lease === undefined || lease.owner !== owner || lease.attached || params.partition !== lease.partition) {
        event.preventDefault()
        return
      }
      lease.attached = true
      // Keep Electron's allowpopups dispatch flag; the guest handler still denies native windows.
      for (const key of Object.keys(preferences)) {
        if (key !== 'disablePopups') Reflect.deleteProperty(preferences, key)
      }
      Object.assign(preferences, {
        partition: lease.partition,
        nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
        contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
        webviewTag: false, plugins: false, navigateOnDragDrop: false, disableDialogs: true,
        devTools: !app.isPackaged,
      })
      params.httpreferrer = ''
    })
    owner.on('did-attach-webview', (_event, guest) => {
      let attachedLease: DesktopBrowserLeaseId | undefined
      // The first document is an inert about:blank carrying the approved lease.
      // Bind on the main-process event before the renderer can navigate the ready guest.
      guest.once('dom-ready', () => {
        const url = guest.getURL()
        const id = (url.startsWith('about:blank#') ? url.slice('about:blank#'.length) : '') as DesktopBrowserLeaseId
        const lease = this.leases.get(id)
        if (lease === undefined || lease.owner !== owner || lease.guest !== undefined) {
          guest.close({ waitForBeforeUnload: false })
          return
        }
        lease.guest = guest
        attachedLease = id
        lease.releaseInput = attachInput(guest, id)
        guest.once('destroyed', () => { lease.releaseInput?.(); this.leases.delete(id) })
        for (const listener of [...this.readyListeners]) listener(lease.session)
      })
      guest.setWindowOpenHandler(({ url, postBody }) => {
        const lease = attachedLease === undefined ? undefined : this.leases.get(attachedLease)
        if (attachedLease !== undefined && lease?.guest === guest && lease.owner === owner && !owner.isDestroyed()
          && postBody === undefined && this.allowedNavigation(url)) {
          const request: DesktopBrowserOpenRequest = { lease: attachedLease, url: new URL(url).href }
          owner.send(DESKTOP_IPC.browserOpenRequested, request)
        }
        return { action: 'deny' }
      })
      guest.on('will-frame-navigate', (event) => {
        if (event.isMainFrame && !this.allowedNavigation(event.url)) event.preventDefault()
      })
      guest.on('will-redirect', (event, url, _inPlace, mainFrame) => {
        if (mainFrame && !this.allowedNavigation(url)) event.preventDefault()
      })
      guest.on('will-attach-webview', (event) => { event.preventDefault() })
      guest.on('login', (event, _details, _authInfo, callback) => { event.preventDefault(); callback() })
    })
    const releaseAll = (): void => {
      for (const [id, lease] of this.leases) {
        if (lease.owner === owner) void this.release(owner, id).catch((error: unknown) => { console.error(error) })
      }
    }
    owner.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) releaseAll()
    })
    owner.on('render-process-gone', releaseAll)
    owner.once('destroyed', releaseAll)
  }

  /**
   * List the attached guests of one Session in reservation order.
   * @param chatSession - Session whose right-Sidebar tabs are requested.
   * @returns live guests; a tab whose guest is not attached yet is absent.
   */
  agentGuests(chatSession: string): DesktopAgentGuest[] {
    const guests: DesktopAgentGuest[] = []
    for (const [lease, entry] of this.leases) {
      if (entry.session === chatSession && entry.guest !== undefined && !entry.guest.isDestroyed()) {
        guests.push({ tab: entry.agentTab, lease, guest: entry.guest })
      }
    }
    return guests
  }

  /**
   * @param listener - receives the Session of every guest that becomes attached.
   * @returns unsubscribe callback.
   */
  onGuestReady(listener: (chatSession: string) => void): () => void {
    this.readyListeners.add(listener)
    return () => { this.readyListeners.delete(listener) }
  }

  /**
   * Ask the application window to open a browser tab in one Session's right Sidebar.
   * @param chatSession - Session that receives the tab.
   * @param url - address checked by {@link isAllowedNavigation}.
   * @returns whether an application window received the request.
   */
  requestAgentOpen(chatSession: string, url: string): boolean {
    const owner = [...this.owners].findLast(candidate => !candidate.isDestroyed())
    if (owner === undefined) return false
    const request: DesktopBrowserAgentOpenRequest = { session: chatSession, url }
    owner.send(DESKTOP_IPC.browserAgentOpenRequested, request)
    return true
  }

  /**
   * Tell the owning window whether an agent is operating a tab.
   * @param lease - operated guest's lease.
   * @param active - whether a command is running or ran moments ago.
   */
  setAgentActivity(lease: DesktopBrowserLeaseId, active: boolean): void {
    const owner = this.leases.get(lease)?.owner
    if (owner === undefined || owner.isDestroyed()) return
    const activity: DesktopBrowserAgentActivity = { lease, active }
    owner.send(DESKTOP_IPC.browserAgentActivity, activity)
  }

  /**
   * @param value - candidate top-level address.
   * @returns whether a guest may navigate there: HTTP(S), no credentials, not the application Host.
   */
  isAllowedNavigation(value: string): boolean {
    return this.allowedNavigation(value)
  }

  private configureSession(browserSession: Session): void {
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
    browserSession.setPermissionCheckHandler(() => false)
    browserSession.setDevicePermissionHandler(() => false)
    browserSession.setDisplayMediaRequestHandler((_request, callback) => { callback({}) })
    browserSession.on('will-download', (event) => { event.preventDefault() })
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const network = ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)
      callback({ cancel: network
        ? url.username !== '' || url.password !== '' || this.isApplicationHost(url)
        : !['about:', 'data:', 'blob:'].includes(url.protocol) })
    })
  }

  private allowedNavigation(value: string): boolean {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.username === '' && url.password === ''
      && !this.isApplicationHost(url)
  }

  private isApplicationHost(url: URL): boolean {
    const value = this.hostUrl()
    if (value === undefined) return false
    const host = new URL(value)
    return url.port === host.port
      && (url.hostname === host.hostname || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  }
}
