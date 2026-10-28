---
description: "Chat rows for the Desktop browser tools: a compact action summary per call with the result text on expansion."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-browser-tools

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-browser-tools` shows each Desktop browser tool call in the chat as one line, such as `Browser · Open page www.ozon.ru` or `Browser · Type text «headphones»`. A settled row expands into the exact text the model received. The rows derive from the logged call and result alone, so replayed chats render them the same way.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web application bundle mounts the plugin in the Desktop profile only, beside the right-Sidebar browser, because only the Desktop Host registers the tools of [dsh-browser-use-desktop](../../browser-use/browser-use-desktop/README.md).

```yaml
- id: ui-browser-tools
  name: '@deepseek-ai/dsh-client-ui-browser-tools'
  disabled: !!js "ctx.get('profileContext')?.name !== 'desktop'"
```

A row shows the globe glyph, the `Browser` title, and the action with its salient argument: the host and path of an address, the first line of typed text, the key, the scroll direction, or the element ref. Running calls carry the shimmer highlight, a failed call shows the first line of its error, and an interrupted call shows `Stopped`. The copy is localized in eight languages under the `browserTools` namespace.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Registers the dictionaries and one `tool.call.toolview` entry per browser tool name |
| [`src/client/BrowserToolRow.tsx`](src/client/BrowserToolRow.tsx) | The row, the tool-name to action map, and argument summarization |
| [`src/client/locales.ts`](src/client/locales.ts) | The `browserTools` dictionaries |

The rows live in their own package because the right-Sidebar browser package is a dependency of the chat package, which the tool-row package depends on.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [dsh-browser-use-desktop](../../browser-use/browser-use-desktop/README.md) — the tools these rows present.
- [ui-tool](../ui-tool/README.md) — the tool-call presentation layer hosting the `tool.call.toolview` slot.

-----

<a id="model-experience"></a>
## Model Experience

None, as the rows only present logged calls.

#### KV Cache effect

Rendering does not alter model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Screenshots show as text**: the expanded row lists the result text and omits the captured image.
- **Result-only history pages use the generic row**: keyed dispatch needs the paired call in the loaded history window.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
