/**
 * `SearxngSearchProvider`: a `WebSearchProvider` backed by a SearXNG instance
 * (`GET /search?format=json`). SearXNG is a free, keyless metasearch engine; the
 * deployment names the instance it trusts. Each result's `content` excerpt becomes
 * `snippet`, and `publishedDate` becomes `publishedAt`. SearXNG returns no generated
 * answer, so `content` is omitted.
 * @module @deepseek-ai/dsh-web-search-searxng/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { SearxngResult, SearxngSearchResponse } from './types.ts'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Resolved provider options. */
export interface SearxngSearchProviderOptions {
  /** Instance base URL; `/search` is appended. */
  baseURL: string
  /** Optional SearXNG `language` parameter, such as `ru` or `en-US`; omitted lets the instance decide. */
  language?: string
}

/**
 * Map one SearXNG result to a normalized source, or `undefined` when it has no URL.
 * @param result - one entry of SearXNG's `results[]`.
 * @returns the normalized source, or `undefined` for an entry without a URL.
 */
export function mapSearxngResult(result: SearxngResult): WebSearchSource | undefined {
  if (result.url === undefined || result.url.length === 0) return undefined
  const snippet = result.content?.trim()
  return {
    url: result.url,
    ...result.title != null && result.title.length > 0 ? { title: result.title } : {},
    ...snippet !== undefined && snippet.length > 0 ? { snippet } : {},
    ...result.publishedDate != null && result.publishedDate.length > 0 ? { publishedAt: result.publishedDate } : {},
  }
}

/**
 * Map a SearXNG response envelope to a normalized search result.
 * @param response - the parsed JSON response body.
 * @returns the normalized result; URL-less entries are dropped.
 */
export function mapSearxngResponse(response: SearxngSearchResponse): WebSearchResult {
  const sources = (response.results ?? [])
    .map(mapSearxngResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  // The web service owns the final `maxResults` truncation.
  return { sources, truncated: false }
}

/** The SearXNG-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  constructor(private readonly options: SearxngSearchProviderOptions) {}

  available(): boolean {
    return URL.canParse(this.options.baseURL)
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const url = new URL(`${this.options.baseURL.replace(/\/+$/u, '')}/search`)
    url.searchParams.set('q', request.query)
    url.searchParams.set('format', 'json')
    if (this.options.language !== undefined) url.searchParams.set('language', this.options.language)
    let response: Response
    try {
      response = await fetch(url, {
        redirect: 'error',
        headers: { accept: 'application/json' },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SearXNG search request to ${this.options.baseURL} failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
    if (!response.ok) {
      // 403 is SearXNG's answer when the instance does not enable the JSON format.
      const hint = response.status === 403 ? '; enable `json` in the instance\'s search.formats' : ''
      await response.body?.cancel()
      throw new WebError(`SearXNG error (HTTP ${response.status})${hint}`, 'WEB_PROVIDER_ERROR')
    }
    try {
      return mapSearxngResponse(await response.json() as SearxngSearchResponse)
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SearXNG returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
