/** Type-only Electron bridge declarations shared by the desktop shell and browser provider. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Main-issued identity of one guest reservation. */
export type DesktopBrowserLeaseId = Branded<'DesktopBrowserLeaseId'>

/** A guest's approved, process-local storage partition. */
export interface DesktopBrowserReservation {
  readonly lease: DesktopBrowserLeaseId
  readonly partition: string
}

/** Main-approved request to open an HTTP(S) page from an existing guest. */
export interface DesktopBrowserOpenRequest {
  readonly lease: DesktopBrowserLeaseId
  readonly url: string
}

/** Main-approved request from an agent command to open a browser tab in one Session's right Sidebar. */
export interface DesktopBrowserAgentOpenRequest {
  readonly session: string
  readonly url: string
}

/** Whether an agent command is operating one guest. */
export interface DesktopBrowserAgentActivity {
  readonly lease: DesktopBrowserLeaseId
  readonly active: boolean
}

/** Origin-scoped operations; no Electron objects or arbitrary IPC cross this interface. */
export interface DesktopBrowserBridge {
  /**
   * @param workspace - resolved storage account.
   * @param session - Session whose right Sidebar holds the tab; agent commands of that Session may operate it.
   * @returns one approved guest reservation.
   */
  acquire(workspace: string, session: string): Promise<DesktopBrowserReservation>
  /** @param lease - the caller's reservation. @returns after its guest has been destroyed. */
  release(lease: DesktopBrowserLeaseId): Promise<void>
  /** @param lease - originating guest. @param listener - approved URL consumer. @returns unsubscribe callback. */
  onOpenRequested(lease: DesktopBrowserLeaseId, listener: (url: string) => void): () => void
  /** @param listener - consumer of agent requests to open a tab. @returns unsubscribe callback. */
  onAgentOpenRequested(listener: (request: DesktopBrowserAgentOpenRequest) => void): () => void
  /** @param lease - observed guest. @param listener - receives agent activity changes. @returns unsubscribe callback. */
  onAgentActivity(lease: DesktopBrowserLeaseId, listener: (active: boolean) => void): () => void
}
