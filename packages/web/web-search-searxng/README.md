---
description: "The SearXNG-backed search provider for ctx.web: how deployments mount free, keyless web search through a SearXNG instance they run."
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-searxng

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-searxng`, the harness searches the web through a SearXNG instance, a free open-source metasearch engine that needs no API key or account. The shipped profiles use it as the only search provider at `http://127.0.0.1:8888`, and `DSH_SEARXNG_URL` names another instance. The instance must enable the JSON output format. SearXNG returns no generated answer, so results carry only citeable sources. The model-facing `web_search` tool lives in `dsh-tool-web`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the provider in a composition that loads the web service; it registers as the `searxng` search provider.

```yaml
- name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: searxng
- name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    baseURL: http://127.0.0.1:8888
```

| Field | Default | Meaning |
|---|---|---|
| `baseURL` | (required) | SearXNG instance base URL; `/search` is appended. An unparseable value fails at load |
| `language` | (unset) | SearXNG `language` parameter, such as `ru` or `en-US`; unset lets the instance decide |

### Run a local instance

Desktop needs no setup: it bundles SearXNG, starts it in the background, and passes its address as `DSH_SEARXNG_URL` ([Desktop bundled web search](../../../apps/desktop/README.md#bundled-web-search)). Other launches need an instance of their own.

The official container image serves SearXNG on port 8080. The instance's `settings.yml` must list `json` under `search.formats`; otherwise SearXNG answers HTTP 403 and the provider reports that the format is disabled.

```yaml
use_default_settings: true
server:
  secret_key: "<random hex string>"
  limiter: false
search:
  formats:
    - html
    - json
```

```bash
docker run -d --name dsh-searxng --restart unless-stopped -p 127.0.0.1:8888:8080 -v "$HOME/.dsh/searxng:/etc/searxng" searxng/searxng:latest
```

### What a search returns

Each SearXNG result maps to a `WebSearchSource`: `url`, a non-empty `title`, the trimmed `content` excerpt as `snippet`, and `publishedDate` as `publishedAt`. A result without a URL is dropped. The service applies the request's `maxResults` bound. A refused connection, a non-2xx status, or an unprocessable body fails with `WEB_PROVIDER_ERROR`; cancellation fails with `WEB_ABORTED`.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The provider sends one `GET /search?q=<query>&format=json` request per search, with `language` when configured, rejects redirects, and maps the response without inventing snippets or answers.

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema, load-time URL check, provider registration |
| [`src/provider.ts`](src/provider.ts) | The `SearxngSearchProvider`: request dispatch, error classification, result mapping |
| [`src/types.ts`](src/types.ts) | SearXNG JSON response fields the provider reads |

</details>

## Model Experience

Indirectly, through `dsh-tool-web`, which retains this provider's `maxResults`-bounded URLs, titles, excerpts, and publication dates or its exact `SearXNG search aborted`, `SearXNG search request to <baseURL> failed: <error>`, `SearXNG error (HTTP <status>)`, and `SearXNG returned an unprocessable response body: <error>` failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Outside Desktop, the instance runs outside the harness**: CLI and Web launches neither start nor monitor SearXNG, so a stopped instance fails every search until it runs again.
- **Upstream engines decide availability**: SearXNG forwards queries to public engines that may rate-limit or block it, which yields fewer or no results.
- **Only `language` is exposed**: categories, time ranges, and engine selection stay at the instance's settings.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
