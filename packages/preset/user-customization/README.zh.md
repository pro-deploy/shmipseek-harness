---
description: "面向所有 Agent 的用户可编辑全局系统提示词、MCP 服务器和技能，通过客户端设置页面编辑。"
kind: "package-reference"
---

# @deepseek-ai/dsh-user-customization

[English](README.md) | 中文

## 概述

`dsh-user-customization` 让用户在客户端的插件页面中塑造所有 Agent，而无需编辑配置文件。本包包含三个插件：追加在部署人设之后的全局系统提示词、工具可供所有 Agent 调用的 MCP 服务器，以及所有 Agent 都能加载的技能。基础 bundle 挂载全部三个插件，[dsh-client-ui-settings-customization](../../client/ui-settings-customization/README.zh.md) 提供它们的页面。保存的值无需重启即可生效。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

每个行 id 就是其页面编辑的设置命名空间，每个被编辑的字段都是 volatile 字段，因此设置服务把它写入当前 profile patch，运行中的插件读取新值。

```yaml
- id: user-system-prompt
  name: '@deepseek-ai/dsh-user-customization'
- id: user-mcp-servers
  name: '@deepseek-ai/dsh-user-customization/mcp-servers'
  config:
    pollIntervalMs: 1000
- id: user-skills
  name: '@deepseek-ai/dsh-user-customization/skills'
  config:
    pollIntervalMs: 1000
```

| 行 | 字段 | 含义 |
|---|---|---|
| `user-system-prompt` | `text` | 用户的指令；留空则不添加任何内容。下一次提示词组装读取保存的文本 |
| `user-mcp-servers` | `servers` | 服务器，包含 `name`、`enabled`、`transport`（`stdio` 或 `streamable-http`）、`command`、`args`、`env`、`url`、`headers` |
| `user-mcp-servers` | `pollIntervalMs` | 将保存的列表与已连接集合比较的间隔；至少 100 |
| `user-skills` | `skills` | 技能，包含 `name`、`enabled`、`description`、`content` |
| `user-skills` | `pollIntervalMs` | 将保存的列表与已注册集合比较的间隔；至少 100 |

启用的服务器通过一个以条目命名的 `dsh-mcp-client` 子插件连接，因此其工具显示为 `mcp__<name>__<tool>`。保存列表后，被删除或修改的服务器断开，新服务器连接，未变化的服务器保持连接。名称无效或重复的条目、缺少命令的 stdio 条目，以及缺少绝对 URL 的 URL 条目会被跳过并记录错误。

启用的技能作为运行时技能注册到全局注册层，因此每个 Agent 的目录都会把它与磁盘上发现的技能一起列出。名称不是 kebab-case 或描述为空的技能会被跳过并记录错误。

`user-system-prompt` 行还提供仅所有者可用的 `userSystemPrompt/preview` Remote，系统提示词页面读取它来显示当前提示词。它在每次调用时渲染无作用域的提示词段落，因此包含已保存的文本，但不包含 Agent 预设、计划模式或按 Agent 注册的工具在 Agent 作用域内注册的段落。只能在 Agent 轮次内解析的变量（例如 `{{model}}`）保持原样。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节：点击展开</summary>

volatile 值没有变更通知，因此服务器和技能插件按定时器比较保存的列表快照与上次应用的快照，只在写入后才进行协调。系统提示词段落则在每次组装时读取其值。

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 位于 `USER_SYSTEM_PROMPT` 顺序的全局系统提示词段落，以及 `userSystemPrompt` 预览 Remote |
| [`src/types.ts`](src/types.ts) | 预览 Remote 的结果类型 |
| [`src/mcp-servers.ts`](src/mcp-servers.ts) | 基于 `dsh-mcp-client` 子插件的服务器列表协调 |
| [`src/skills.ts`](src/skills.ts) | 将技能列表注册到技能注册表 |

</details>

<a id="model-experience"></a>
## 模型体验

### 用户系统提示词段落

#### 模型看到什么

位于 order `100`、紧跟部署人设之后的 `user-system-prompt` 段落按字面携带保存的文本：这里的 `{{...}}` 不是提示词变量。文本为空时不添加段落。MCP 服务器的工具与说明以及用户技能通过 `dsh-mcp-client` 和技能目录到达模型。

##### `user-system-prompt` 段落

```markdown
<the text saved on the System prompt page, with surrounding whitespace removed>
```

#### Token 影响

每个 Agent 的每次请求都携带保存文本的 token；文本为空时不携带。每个启用的服务器添加其工具 schema，每个启用的技能添加一条目录项。

#### KV Cache 影响

保存的文本、服务器列表和技能列表不变时，前缀保持稳定。编辑系统提示词会改变人设之后的早期前缀；添加或删除服务器或技能会改变工具与目录部分。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **保存的列表在一个轮询间隔内生效**：服务器或技能的修改在保存后最多 `pollIntervalMs` 后生效。
- **密钥以普通设置保存**：环境变量和请求头保存在 profile patch 中；只用于用户接受存放在那里的值。
- **技能是单个文档**：在这里编写的技能没有附带资源文件；需要文件的技能应放在 `~/.dsh/skills` 或 `~/.agents/skills` 中。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文：点击展开</summary>

无。

</details>
