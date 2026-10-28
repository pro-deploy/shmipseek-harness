import { createServer, type IncomingMessage, type Server } from 'node:http'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as searxngPlugin from '@deepseek-ai/dsh-web-search-searxng'
import { SEARXNG_PROVIDER_ID, SearxngSearchProvider, mapSearxngResult } from '@deepseek-ai/dsh-web-search-searxng'

// The JSON envelope a SearXNG instance returns for `format=json`, with every top-level
// member and the per-result members the engines emit; the provider must select what it needs.
const RESPONSE = {
  query: 'deepseek harness',
  number_of_results: 0,
  results: [
    {
      url: 'https://example.org/harness', title: 'Harness overview', content: '  An overview of the harness.  ',
      thumbnail: '', engine: 'duckduckgo', template: 'default.html',
      parsed_url: ['https', 'example.org', '/harness', '', '', ''], img_src: '', priority: '',
      engines: ['duckduckgo', 'brave'], positions: [1, 2], score: 3.0, category: 'general', publishedDate: '2026-09-01T00:00:00',
    },
    {
      url: 'https://example.org/empty', title: '', content: null, engine: 'wikipedia', template: 'default.html',
      parsed_url: ['https', 'example.org', '/empty', '', '', ''], engines: ['wikipedia'], positions: [3], score: 0.3,
      category: 'general', publishedDate: null,
    },
    { title: 'No URL', content: 'dropped', engine: 'brave', engines: ['brave'], positions: [4], score: 0.1, category: 'general' },
  ],
  answers: [],
  corrections: [],
  infoboxes: [],
  suggestions: ['deepseek harness github'],
  unresponsive_engines: [['google', 'timeout']],
}

const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.closeAllConnections()
    const closed = once(server, 'close')
    server.close()
    await closed
  }))
})

async function instance(reply: (request: IncomingMessage) => { status: number; body: string }): Promise<{ url: string; requests: URL[] }> {
  const requests: URL[] = []
  const server = createServer((request, response) => {
    requests.push(new URL(request.url ?? '/', 'http://instance.test'))
    const { status, body } = reply(request)
    response.writeHead(status, { 'content-type': 'application/json' }).end(body)
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('missing instance address')
  return { url: `http://127.0.0.1:${address.port}`, requests }
}

describe('SearXNG result mapping', () => {
  it('keeps the URL, title, trimmed excerpt, and date, and omits empty fields', () => {
    expect(mapSearxngResult(RESPONSE.results[0]!)).toEqual({
      url: 'https://example.org/harness', title: 'Harness overview', snippet: 'An overview of the harness.', publishedAt: '2026-09-01T00:00:00',
    })
    expect(mapSearxngResult(RESPONSE.results[1]!)).toEqual({ url: 'https://example.org/empty' })
    expect(mapSearxngResult(RESPONSE.results[2]!)).toBeUndefined()
  })
})

describe('SearxngSearchProvider', () => {
  it('queries the JSON API and normalizes the complete response', async () => {
    const server = await instance(() => ({ status: 200, body: JSON.stringify(RESPONSE) }))
    const provider = new SearxngSearchProvider({ baseURL: `${server.url}/`, language: 'ru' })
    expect(provider.available()).toBe(true)
    const result = await provider.search({ query: 'deepseek harness', maxResults: 5 })
    expect(server.requests.map(url => [url.pathname, Object.fromEntries(url.searchParams)]))
      .toEqual([['/search', { q: 'deepseek harness', format: 'json', language: 'ru' }]])
    expect(result).toEqual({
      sources: [
        { url: 'https://example.org/harness', title: 'Harness overview', snippet: 'An overview of the harness.', publishedAt: '2026-09-01T00:00:00' },
        { url: 'https://example.org/empty' },
      ],
      truncated: false,
    })
  })

  it('explains a disabled JSON format and reports other failures as provider errors', async () => {
    const forbidden = await instance(() => ({ status: 403, body: '' }))
    await expect(new SearxngSearchProvider({ baseURL: forbidden.url }).search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR', message: expect.stringContaining('search.formats') as string })
    const malformed = await instance(() => ({ status: 200, body: '{"results": 7}' }))
    await expect(new SearxngSearchProvider({ baseURL: malformed.url }).search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    await expect(new SearxngSearchProvider({ baseURL: 'http://127.0.0.1:1' }).search({ query: 'q' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
  })

  it('maps cancellation to WEB_ABORTED', async () => {
    const server = await instance(() => ({ status: 200, body: JSON.stringify(RESPONSE) }))
    const controller = new AbortController()
    controller.abort()
    await expect(new SearxngSearchProvider({ baseURL: server.url }).search({ query: 'q' }, controller.signal))
      .rejects.toMatchObject({ code: 'WEB_ABORTED' })
  })
})

describe('web-search-searxng plugin registration', () => {
  it('registers into ctx.web, serves searches, and unregisters on disposal (HMR-safe)', async () => {
    const server = await instance(() => ({ status: 200, body: JSON.stringify(RESPONSE) }))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, {})
    const fiber = ctx.plugin(searxngPlugin, { baseURL: server.url })
    await fiber
    expect((await ctx.web.search({ query: 'deepseek harness' })).sources).toHaveLength(2)
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'deepseek harness' })).rejects.toMatchObject({ code: 'WEB_PROVIDER_UNAVAILABLE' })
    expect(SEARXNG_PROVIDER_ID).toBe('searxng')
    await ctx.fiber.dispose()
  })

  it('fails loud at load for an unparseable baseURL', async () => {
    const ctx = new Context()
    await ctx.plugin(WebRuntime, {})
    await expect(ctx.plugin(searxngPlugin, { baseURL: 'not a url' })).rejects.toThrow('absolute URL')
    await ctx.fiber.dispose()
  })
})
