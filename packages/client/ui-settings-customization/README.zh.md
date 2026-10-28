---
description: "插件页面中用户全局系统提示词、MCP 服务器和技能的设置。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-customization

[English](README.md) | 中文

## 概述

在侧栏打开**插件**，并在官方分组中选择**系统提示词**、**MCP 服务器**或**技能**，即可定制所有 Agent。系统提示词页面编辑一段会加入每个系统提示词的文本，并在其下方以只读方式显示 Host 组装的当前提示词。MCP 服务器页面可以添加、编辑、启用、删除服务器，并从 `mcpServers` JSON 导入。技能页面用于编写具名的 Markdown 指令。每个页面先暂存修改，只在保存时写入；每个页面在 Host 提供 [dsh-user-customization](../../preset/user-customization/README.zh.md) 的对应命名空间时存在。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Web bundle 挂载本包，无需配置。这些页面编辑 `user-system-prompt`、`user-mcp-servers` 和 `user-skills` 命名空间。

服务器使用本地程序（命令、每行一个参数、每行一个 `NAME=value` 环境变量）或 URL（每行一个 `Name: value` 请求头）。**导入 JSON** 接受 MCP 服务器文档中发布的配置，带或不带 `mcpServers` 外层均可；导入的服务器会替换同名服务器。无效名称会就地标出，Host 会跳过它们，直到修正为止。

每个可编辑字段都以占位符形式显示示例。系统提示词页面上的当前提示词在打开页面时、每次保存后以及点击**刷新**时，从 Host 的 `userSystemPrompt` Remote 读取；它不包含 Agent 预设、计划模式或会话工具在会话期间添加的段落，并保留 `{{model}}` 原样。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节：点击展开</summary>

每个页面通过共享的设置表单模型暂存一个字段。列表页面把列表暂存为 JSON 文本，因此共享的保存栏、修改状态和冲突处理无需改动即可适用。

| 文件 | 职责 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 在各命名空间被提供时注册页面；系统提示词页面还会等待其预览 Remote |
| [`src/client/controllers.ts`](src/client/controllers.ts) | 暂存的单字段表单与 JSON 列表字段 |
| [`src/client/pages.tsx`](src/client/pages.tsx) | 三个页面 |
| [`src/client/entries.ts`](src/client/entries.ts) | 文本控件转换与 `mcpServers` 导入 |

</details>

<a id="model-experience"></a>
## 模型体验

无，因为本包是浏览器侧的设置界面，不注册任何模型可见内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **环境变量和请求头在页面上可见**：它们作为普通设置保存，而不是被遮蔽的凭据。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文：点击展开</summary>

无。

</details>
