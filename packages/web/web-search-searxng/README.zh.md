---
description: "ctx.web 的 SearXNG 搜索提供方：部署方如何通过自行运行的 SearXNG 实例挂载免费、无需密钥的网页搜索。"
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-searxng

[English](README.md) | 中文

## 概述

借助 `dsh-web-search-searxng`，harness 通过 SearXNG 实例搜索网页。SearXNG 是免费的开源元搜索引擎，无需 API 密钥或账户。随附 profile 将其作为唯一搜索提供方，地址为 `http://127.0.0.1:8888`，`DSH_SEARXNG_URL` 可指定其他实例。实例必须启用 JSON 输出格式。SearXNG 不返回生成的答案，因此结果只包含可引用的来源。面向模型的 `web_search` 工具位于 `dsh-tool-web`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在加载 web 服务的组合中挂载该提供方；它以 `searxng` 搜索提供方身份注册。

```yaml
- name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: searxng
- name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    baseURL: http://127.0.0.1:8888
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `baseURL` | （必填） | SearXNG 实例基础 URL，会追加 `/search`。无法解析的值在加载时报错 |
| `language` | （未设置） | SearXNG 的 `language` 参数，例如 `ru` 或 `en-US`；未设置时由实例决定 |

### 运行本地实例

Desktop 无需任何设置：它内置 SearXNG，在后台启动它，并通过 `DSH_SEARXNG_URL` 传入地址（[Desktop 内置网页搜索](../../../apps/desktop/README.zh.md#bundled-web-search)）。其他启动方式需要自己的实例。

官方容器镜像在 8080 端口提供 SearXNG。实例的 `settings.yml` 必须在 `search.formats` 中列出 `json`；否则 SearXNG 返回 HTTP 403，提供方会报告该格式未启用。

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

### 搜索返回什么

每条 SearXNG 结果映射为一个 `WebSearchSource`：`url`、非空 `title`、去除首尾空白的 `content` 摘录作为 `snippet`，以及作为 `publishedAt` 的 `publishedDate`。没有 URL 的结果会被丢弃。服务负责应用请求的 `maxResults` 上限。连接被拒、非 2xx 状态或无法处理的响应体以 `WEB_PROVIDER_ERROR` 失败；取消以 `WEB_ABORTED` 失败。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节：点击展开</summary>

每次搜索发送一条 `GET /search?q=<query>&format=json` 请求，配置了 `language` 时一并携带；提供方拒绝重定向，并在不编造摘录或答案的前提下映射响应。

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：配置 schema、加载时 URL 检查、注册提供方 |
| [`src/provider.ts`](src/provider.ts) | `SearxngSearchProvider`：请求发送、错误分类、结果映射 |
| [`src/types.ts`](src/types.ts) | 提供方读取的 SearXNG JSON 响应字段 |

</details>

<a id="model-experience"></a>
## 模型体验

间接通过 `dsh-tool-web` 体现：它保留本提供方受 `maxResults` 约束的 URL、标题、摘录与发布日期，或在消费方错误包装下保留确切的 `SearXNG search aborted`、`SearXNG search request to <baseURL> failed: <error>`、`SearXNG error (HTTP <status>)` 与 `SearXNG returned an unprocessable response body: <error>` 失败信息。

#### KV Cache 影响

无直接失效；所述消费方负责任何请求前缀变化。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **在 Desktop 之外，实例运行在 harness 之外**：CLI 与 Web 启动方式既不启动也不监控 SearXNG，实例停止后每次搜索都会失败，直到它重新运行。
- **上游引擎决定可用性**：SearXNG 会把查询转发给公共搜索引擎，这些引擎可能对其限流或封锁，导致结果变少或为空。
- **只暴露 `language`**：类别、时间范围与引擎选择保留在实例设置中。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文：点击展开</summary>

无。

</details>
