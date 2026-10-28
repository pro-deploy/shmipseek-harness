---
description: "Desktop 浏览器工具的聊天行：每次调用一行简洁的操作摘要，展开后显示结果文本。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-browser-tools

[English](README.md) | 中文

## 概述

`dsh-client-ui-browser-tools` 把每次 Desktop 浏览器工具调用在聊天中显示为一行，例如 `浏览器 · 打开页面 www.ozon.ru` 或 `浏览器 · 输入文本 «耳机»`。已完成的行可展开为模型收到的原文。行只由记录的调用与结果推导，因此回放的会话以相同方式渲染。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延后工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

Web 应用 bundle 仅在 Desktop profile 中、紧挨右侧边栏浏览器挂载本插件，因为只有 Desktop Host 注册 [dsh-browser-use-desktop](../../browser-use/browser-use-desktop/README.zh.md) 的工具。

```yaml
- id: ui-browser-tools
  name: '@deepseek-ai/dsh-client-ui-browser-tools'
  disabled: !!js "ctx.get('profileContext')?.name !== 'desktop'"
```

一行显示地球图标、`浏览器` 标题，以及操作与其关键参数：地址的主机与路径、输入文本的第一行、按键、滚动方向或元素 ref。运行中的调用带有闪光高亮，失败的调用显示错误的第一行，被中断的调用显示 `已停止`。文案在 `browserTools` 命名空间下提供八种语言。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

| 文件 | 职责 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 注册词典，并为每个浏览器工具名注册一个 `tool.call.toolview` 条目 |
| [`src/client/BrowserToolRow.tsx`](src/client/BrowserToolRow.tsx) | 行组件、工具名到操作的映射与参数摘要 |
| [`src/client/locales.ts`](src/client/locales.ts) | `browserTools` 词典 |

行位于独立的包中，因为右侧边栏浏览器包是聊天包的依赖，而工具行包依赖聊天包。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [dsh-browser-use-desktop](../../browser-use/browser-use-desktop/README.zh.md) — 这些行所展示的工具。
- [ui-tool](../ui-tool/README.zh.md) — 承载 `tool.call.toolview` 插槽的工具调用展示层。

-----

<a id="model-experience"></a>
## 模型体验

无，这些行只展示已记录的调用。

#### KV Cache 影响

渲染不改变模型请求。

## 已知限制与延后工作

<a id="known-limitations-and-deferred-work"></a>

- **截图以文本显示**：展开的行列出结果文本，不显示截取的图像。
- **仅含结果的历史页使用通用行**：键控分发需要已加载历史窗口中的配对调用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>
