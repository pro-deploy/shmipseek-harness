---
description: "Plugins page settings for the user's global system prompt, MCP servers, and skills."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-customization

English | [中文](README.zh.md)

## Summary

Open **Plugins** in the sidebar and select **System prompt**, **MCP servers**, or **Skills** in the Official group to customize every agent. The system prompt page edits one text added to every system prompt and shows, read-only below it, the current prompt the Host assembles. The MCP servers page adds, edits, enables, removes, and imports servers from `mcpServers` JSON. The skills page writes named Markdown instructions. Each page stages edits and writes them only on save; each exists while the Host serves its namespace from [dsh-user-customization](../../preset/user-customization/README.md).

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web bundle mounts this package; it needs no configuration. The pages edit the `user-system-prompt`, `user-mcp-servers`, and `user-skills` namespaces.

A server uses either a local program (command, one argument per line, one `NAME=value` environment variable per line) or a URL (one `Name: value` header per line). **Import JSON** accepts the configuration published in MCP server documentation, with or without the `mcpServers` wrapper; an imported server replaces the server of the same name. Invalid names are marked in place, and the Host skips them until they are corrected.

Every editable field shows an example as its placeholder. The current prompt on the system prompt page is read from the Host's `userSystemPrompt` Remote when the page opens, after each save, and on **Refresh**; it lacks the sections an agent preset, plan mode, or session tools add during a session, and keeps `{{model}}` as written.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Each page stages one field through the shared settings form model. List pages stage their list as JSON text, so the shared save bar, dirty state, and conflict handling apply unchanged.

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Page registration while each namespace is served; the system prompt page also waits for its preview Remote |
| [`src/client/controllers.ts`](src/client/controllers.ts) | Staged single-field forms and the JSON list field |
| [`src/client/pages.tsx`](src/client/pages.tsx) | The three pages |
| [`src/client/entries.ts`](src/client/entries.ts) | Text-control conversions and `mcpServers` import |

</details>

## Model Experience

None, as the package is a browser-side settings surface that registers no model surface.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Environment variables and headers are visible on the page**: they are stored as ordinary settings, not as masked credentials.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
