/** Lease-scoped browser operations and one main-process event subscription per window. */
import { ipcRenderer } from 'electron'
import type {
  DesktopBrowserAgentOpenRequest, DesktopBrowserBridge, DesktopBrowserLeaseId,
} from '@deepseek-ai/dsh-client-ui-sidebar-browser/types'
import { DESKTOP_IPC } from './ipc.ts'

function dispatch<T>(callbacks: Iterable<(value: T) => void> | undefined, value: T, label: string): void {
  for (const callback of [...callbacks ?? []]) {
    try { callback(value) }
    catch (error) { console.error(label, error) }
  }
}

function subscribe<T>(listeners: Map<DesktopBrowserLeaseId, Set<(value: T) => void>>, lease: DesktopBrowserLeaseId,
  listener: (value: T) => void): () => void {
  let callbacks = listeners.get(lease)
  if (callbacks === undefined) { callbacks = new Set(); listeners.set(lease, callbacks) }
  callbacks.add(listener)
  return () => {
    callbacks.delete(listener)
    if (callbacks.size === 0 && listeners.get(lease) === callbacks) listeners.delete(lease)
  }
}

/** @returns browser operations that expose neither IPC nor Electron objects. */
export function createDesktopBrowserBridge(): DesktopBrowserBridge {
  const listeners = new Map<DesktopBrowserLeaseId, Set<(url: string) => void>>()
  const activity = new Map<DesktopBrowserLeaseId, Set<(active: boolean) => void>>()
  const agentOpen = new Set<(request: DesktopBrowserAgentOpenRequest) => void>()
  ipcRenderer.on(DESKTOP_IPC.browserOpenRequested, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || !('lease' in request) || !('url' in request)
      || typeof request.lease !== 'string' || typeof request.url !== 'string') return
    dispatch(listeners.get(request.lease as DesktopBrowserLeaseId), request.url, 'Desktop browser link handler failed')
  })
  ipcRenderer.on(DESKTOP_IPC.browserAgentActivity, (_event, change: unknown) => {
    if (typeof change !== 'object' || change === null || !('lease' in change) || !('active' in change)
      || typeof change.lease !== 'string' || typeof change.active !== 'boolean') return
    dispatch(activity.get(change.lease as DesktopBrowserLeaseId), change.active, 'Desktop browser activity handler failed')
  })
  ipcRenderer.on(DESKTOP_IPC.browserAgentOpenRequested, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || !('session' in request) || !('url' in request)
      || typeof request.session !== 'string' || typeof request.url !== 'string') return
    dispatch(agentOpen, { session: request.session, url: request.url }, 'Desktop browser agent tab handler failed')
  })
  return {
    acquire: (workspace, session) => ipcRenderer.invoke(DESKTOP_IPC.browserAcquire, workspace, session) as ReturnType<DesktopBrowserBridge['acquire']>,
    release: lease => ipcRenderer.invoke(DESKTOP_IPC.browserRelease, lease) as Promise<void>,
    onOpenRequested: (lease, listener) => subscribe(listeners, lease, listener),
    onAgentActivity: (lease, listener) => subscribe(activity, lease, listener),
    onAgentOpenRequested(listener) {
      agentOpen.add(listener)
      return () => { agentOpen.delete(listener) }
    },
  }
}
