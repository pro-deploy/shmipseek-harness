/**
 * SearXNG-backed `WebSearchProvider` plugin. It contributes to the `ctx.web`
 * registry without owning the service.
 *
 * @module @deepseek-ai/dsh-web-search-searxng
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-web'
import { SearxngSearchProvider } from './provider.ts'

export { SEARXNG_PROVIDER_ID, SearxngSearchProvider, mapSearxngResponse, mapSearxngResult } from './provider.ts'
export type { SearxngSearchProviderOptions } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Plugin config. */
export interface Config {
  /** SearXNG instance base URL, such as `http://127.0.0.1:8888`; `/search` is appended. */
  baseURL: string
  /** Optional SearXNG `language` parameter; omitted lets the instance decide. */
  language?: string
}

export const Config: z<Config> = z.object({
  baseURL: z.string().required(),
  language: z.string(),
})

/** Register the SearXNG search provider with `ctx.web`; an unparseable `baseURL` fails at load. */
export function apply(ctx: Context, config: Config): void {
  if (!URL.canParse(config.baseURL)) throw new Error(`web-search-searxng: baseURL must be an absolute URL, got ${JSON.stringify(config.baseURL)}`)
  ctx.web.registerSearchProvider(new SearxngSearchProvider({
    baseURL: config.baseURL,
    ...config.language !== undefined ? { language: config.language } : {},
  }))
}
