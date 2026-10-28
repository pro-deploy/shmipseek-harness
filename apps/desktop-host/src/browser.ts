/** Desktop browser tools over the Host's IPC channel to the Electron main process. */

import type { Context } from '@deepseek-ai/cordis'
import BrowserUseRegistry from '@deepseek-ai/dsh-browser-use'
import * as browserUseDesktop from '@deepseek-ai/dsh-browser-use-desktop'
import type { DesktopBrowserChannel } from '@deepseek-ai/dsh-browser-use-desktop'
import { desktopBrowserResponseSchema, type DesktopBrowserResult } from '@deepseek-ai/dsh-browser-use-desktop/protocol'

/** Pending commands and the message sink of one Host process. */
export interface DesktopBrowserChannelHandle {
  /** Transport handed to the browser tools. */
  readonly channel: DesktopBrowserChannel
  /**
   * Settle the pending command a main-process message answers.
   * @param message - any IPC message from the main process.
   * @returns whether the message was a browser answer.
   */
  receive(message: object): boolean
  /** Fail every pending command; the main process is gone. */
  close(): void
}

/**
 * Create the command channel to the main process.
 * @param send - delivers one IPC message to the main process.
 * @returns channel, message sink, and teardown.
 */
export function createDesktopBrowserChannel(send: (message: object) => Promise<void>): DesktopBrowserChannelHandle {
  let nextRequest = 1
  let closed = false
  const pending = new Map<number, { resolve: (result: DesktopBrowserResult) => void; reject: (error: Error) => void }>()
  return {
    channel: (request, signal) => new Promise<DesktopBrowserResult>((resolve, reject) => {
      if (closed) { reject(new Error('the application window is closing')); return }
      if (signal.aborted) { reject(signal.reason as Error); return }
      const requestId = nextRequest++
      const abort = (): void => {
        pending.delete(requestId)
        reject(signal.reason as Error)
        void send({ type: 'browser-cancel', requestId }).catch((_error: unknown) => {
          // The main process has disconnected; nothing is waiting for the cancellation there.
        })
      }
      signal.addEventListener('abort', abort, { once: true })
      pending.set(requestId, {
        resolve: (result) => { signal.removeEventListener('abort', abort); resolve(result) },
        reject: (error) => { signal.removeEventListener('abort', abort); reject(error) },
      })
      send({ type: 'browser-command', requestId, session: request.session, timeoutMs: request.timeoutMs, command: request.command })
        .catch((error: unknown) => {
          pending.get(requestId)?.reject(error instanceof Error ? error : new Error(String(error)))
          pending.delete(requestId)
        })
    }),
    receive(message) {
      if (!('type' in message) || message.type !== 'browser-result') return false
      const parsed = desktopBrowserResponseSchema.safeParse(message)
      const requestId = 'requestId' in message && typeof message.requestId === 'number' ? message.requestId : undefined
      const waiter = requestId === undefined ? undefined : pending.get(requestId)
      if (waiter === undefined || requestId === undefined) return true
      pending.delete(requestId)
      if (!parsed.success) waiter.reject(new Error('the browser returned an invalid answer'))
      else if ('error' in parsed.data) waiter.reject(new Error(parsed.data.error))
      else waiter.resolve(parsed.data.result)
      return true
    },
    close() {
      closed = true
      for (const waiter of pending.values()) waiter.reject(new Error('the application window is closing'))
      pending.clear()
    },
  }
}

/** Loader identity for the application-owned browser composition. */
export const name = 'desktop-browser'

/** Application-owned transport. */
export interface Config {
  /** Command channel to the main process. */
  readonly channel: DesktopBrowserChannel
}

/**
 * Mount the browser-use registration and the Desktop browser tools.
 * @param ctx - Desktop profile scope.
 * @param config - command channel to the main process.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.plugin(BrowserUseRegistry)
  await ctx.plugin(browserUseDesktop, { channel: config.channel })
}
