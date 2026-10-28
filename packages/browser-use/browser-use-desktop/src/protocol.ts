/**
 * Process-boundary messages between the Desktop Host's browser tools and the Electron main process.
 * Both ends parse every message with these schemas, because each crosses a process boundary.
 * @module @deepseek-ai/dsh-browser-use-desktop/protocol
 */

import { z } from 'zod'

/** Keys the `press` command can send to the focused page element. */
export const DESKTOP_BROWSER_KEYS = [
  'Enter', 'Escape', 'Tab', 'Backspace', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'PageUp', 'PageDown', 'Home', 'End',
] as const

/** One key from {@link DESKTOP_BROWSER_KEYS}. */
export type DesktopBrowserKey = typeof DESKTOP_BROWSER_KEYS[number]

const tab = z.string().min(1).max(64).exactOptional()
const ref = z.number().int().positive()

/** Parser for one browser command; `tab` defaults to the Session's most recently opened tab. */
export const desktopBrowserCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('tabs') }).strict(),
  z.object({ action: z.literal('open'), url: z.string().min(1).max(8192) }).strict(),
  z.object({ action: z.literal('navigate'), tab, url: z.string().min(1).max(8192).exactOptional(),
    history: z.enum(['back', 'forward', 'reload']).exactOptional() }).strict()
    .refine(value => (value.url === undefined) !== (value.history === undefined), 'navigate requires exactly one of url or history'),
  z.object({ action: z.literal('snapshot'), tab, maxTextChars: z.number().int().positive(), maxElements: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('click'), tab, ref }).strict(),
  z.object({ action: z.literal('type'), tab, ref, text: z.string().max(65_536), clear: z.boolean(), submit: z.boolean() }).strict(),
  z.object({ action: z.literal('press'), tab, key: z.enum(DESKTOP_BROWSER_KEYS) }).strict(),
  z.object({ action: z.literal('scroll'), tab, direction: z.enum(['up', 'down']), ref: ref.exactOptional() }).strict(),
  z.object({ action: z.literal('screenshot'), tab }).strict(),
])

/** One validated browser command. */
export type DesktopBrowserCommand = z.infer<typeof desktopBrowserCommandSchema>

const tabInfo = z.object({
  tab: z.string(),
  url: z.string(),
  title: z.string(),
  loading: z.boolean(),
}).strict()

/** Observable state of one right-Sidebar browser tab. */
export type DesktopBrowserTab = z.infer<typeof tabInfo>

const element = z.object({
  ref,
  role: z.string(),
  name: z.string(),
  value: z.string().exactOptional(),
  checked: z.boolean().exactOptional(),
  disabled: z.boolean().exactOptional(),
  inView: z.boolean(),
}).strict()

/** One interactive page element addressed by `ref` in later commands of the same document. */
export type DesktopBrowserElement = z.infer<typeof element>

/** Parser for one main-process answer; `kind` names the result variant. */
export const desktopBrowserResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tabs'), tabs: z.array(tabInfo) }).strict(),
  z.object({ kind: z.literal('page'), tab: tabInfo }).strict(),
  z.object({
    kind: z.literal('snapshot'),
    tab: tabInfo,
    text: z.string(),
    textTruncated: z.boolean(),
    elements: z.array(element),
    elementsTruncated: z.boolean(),
    scroll: z.object({ top: z.number(), height: z.number(), viewport: z.number() }).strict(),
  }).strict(),
  z.object({
    kind: z.literal('screenshot'),
    tab: tabInfo,
    png: z.base64(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
])

/** One validated main-process answer. */
export type DesktopBrowserResult = z.infer<typeof desktopBrowserResultSchema>

/** Host-to-main request; the Session names the right-Sidebar tabs the command may address. */
export const desktopBrowserRequestSchema = z.object({
  type: z.literal('browser-command'),
  requestId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  session: z.string().min(1).max(4096),
  timeoutMs: z.number().int().positive().max(2 ** 31 - 1),
  command: desktopBrowserCommandSchema,
}).strict()

/** One validated Host-to-main request. */
export type DesktopBrowserRequest = z.infer<typeof desktopBrowserRequestSchema>

/** Host-to-main cancellation of one pending request. */
export const desktopBrowserCancelSchema = z.object({
  type: z.literal('browser-cancel'),
  requestId: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict()

/** Main-to-Host answer; exactly one of `result` and `error` is present. */
export const desktopBrowserResponseSchema = z.union([
  z.object({ type: z.literal('browser-result'), requestId: z.number().int().nonnegative(), result: desktopBrowserResultSchema }).strict(),
  z.object({ type: z.literal('browser-result'), requestId: z.number().int().nonnegative(), error: z.string() }).strict(),
])

/** One validated main-to-Host answer. */
export type DesktopBrowserResponse = z.infer<typeof desktopBrowserResponseSchema>
