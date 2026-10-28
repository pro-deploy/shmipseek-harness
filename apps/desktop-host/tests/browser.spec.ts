/** Browser command correlation over the Host's IPC channel to the Electron main process. */
import { expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createDesktopBrowserChannel } from '../src/browser.ts'

function channel() {
  const sent: object[] = []
  const handle = createDesktopBrowserChannel(async (message) => { sent.push(message) })
  return { sent, ...handle }
}

const request = { session: SessionId('chat'), timeoutMs: 1_000, command: { action: 'tabs' as const } }

it('correlates answers by request and rejects failures and malformed answers', async () => {
  const h = channel()
  const first = h.channel(request, new AbortController().signal)
  const second = h.channel(request, new AbortController().signal)
  const third = h.channel(request, new AbortController().signal)
  expect(h.sent).toEqual([1, 2, 3].map(requestId => ({ type: 'browser-command', requestId, ...request })))
  expect(h.receive({ type: 'browser-result', requestId: 2, result: { kind: 'tabs', tabs: [] } })).toBe(true)
  expect(h.receive({ type: 'browser-result', requestId: 1, error: 'no browser tab is open in this chat; use browser_open' })).toBe(true)
  expect(h.receive({ type: 'browser-result', requestId: 3, result: { kind: 'unknown' } })).toBe(true)
  expect(h.receive({ type: 'update-tasks', requestId: 3 })).toBe(false)
  await expect(second).resolves.toEqual({ kind: 'tabs', tabs: [] })
  await expect(first).rejects.toThrow('no browser tab is open in this chat')
  await expect(third).rejects.toThrow('the browser returned an invalid answer')
  expect(h.receive({ type: 'browser-result', requestId: 9, error: 'late' })).toBe(true)
})

it('sends a cancellation for an aborted command and fails pending commands on close', async () => {
  const h = channel()
  const abort = new AbortController()
  const cancelled = h.channel(request, abort.signal)
  const pending = h.channel(request, new AbortController().signal)
  abort.abort(new Error('stopped by the user'))
  await expect(cancelled).rejects.toThrow('stopped by the user')
  expect(h.sent.at(-1)).toEqual({ type: 'browser-cancel', requestId: 1 })
  h.close()
  await expect(pending).rejects.toThrow('the application window is closing')
  await expect(h.channel(request, new AbortController().signal)).rejects.toThrow('the application window is closing')
})
