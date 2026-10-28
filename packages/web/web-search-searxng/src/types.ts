/**
 * Wire types for the SearXNG search API (`GET /search?format=json`). Types only — no
 * runtime code. SearXNG aggregates upstream engines and returns a flat `results[]`; each
 * entry carries a URL, optional title, optional `content` excerpt, and optional
 * `publishedDate`. Instances serve JSON only when `search.formats` lists `json`.
 *
 * @module @deepseek-ai/dsh-web-search-searxng/types
 */

/** One entry of SearXNG's flat `results[]`. */
export interface SearxngResult {
  url?: string
  title?: string | null
  content?: string | null
  publishedDate?: string | null
}

/** SearXNG's JSON search response envelope. */
export interface SearxngSearchResponse {
  results?: SearxngResult[]
}
