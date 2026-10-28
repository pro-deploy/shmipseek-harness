/**
 * Chat rows for the tools of `@deepseek-ai/dsh-browser-use-desktop`. Each row derives from the
 * logged call and result alone, so replayed Sessions render the same rows.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { BROWSER_TOOL_NAMES, BrowserToolRow } from './BrowserToolRow.tsx'
import { en, ja, es, fr, de, ru, pt, zh, NS } from './locales.ts'

export { browserCallDetail } from './BrowserToolRow.tsx'
export type { BrowserToolsKey } from './locales.ts'

/** Required Slot and locale registries. */
export const inject = ['slots', 'locale']

/**
 * Register the dictionaries and one keyed tool row per browser tool name.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-browser-tools: dictionaries')
  for (const key of BROWSER_TOOL_NAMES) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key, locale: NS }, BrowserToolRow))
  }
}
