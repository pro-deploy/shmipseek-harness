---
description: "User-editable global system prompt, MCP servers, and skills for every agent, edited from the client settings pages."
kind: "package-reference"
---

# @deepseek-ai/dsh-user-customization

English | [中文](README.zh.md)

## Summary

`dsh-user-customization` lets the user shape every agent from the client's Plugins page, without editing configuration files. Three plugins share the package: a global system prompt added after the deployment persona, MCP servers whose tools every agent can call, and skills every agent can load. The base bundle mounts all three, and [dsh-client-ui-settings-customization](../../client/ui-settings-customization/README.md) provides their pages. Saved values apply without a restart.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Each row id is the settings namespace its page edits, and each edited field is volatile, so the settings service writes it into the active profile patch and the running plugin reads the new value.

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

| Row | Field | Meaning |
|---|---|---|
| `user-system-prompt` | `text` | The user's instructions; blank adds nothing. The next prompt assembly reads the saved text |
| `user-mcp-servers` | `servers` | Servers with `name`, `enabled`, `transport` (`stdio` or `streamable-http`), `command`, `args`, `env`, `url`, `headers` |
| `user-mcp-servers` | `pollIntervalMs` | How often a saved list is compared with the connected set; at least 100 |
| `user-skills` | `skills` | Skills with `name`, `enabled`, `description`, `content` |
| `user-skills` | `pollIntervalMs` | How often a saved list is compared with the registered set; at least 100 |

An enabled server connects through one `dsh-mcp-client` child named after the entry, so its tools appear as `mcp__<name>__<tool>`. A saved list disconnects removed or changed servers, connects new ones, and leaves unchanged ones connected. An entry with an invalid or duplicate name, a stdio entry without a command, or a URL entry without an absolute URL is skipped with a logged error.

An enabled skill registers as a runtime skill in the global registry layer, so every agent's catalog lists it beside the skills found on disk. A name that is not kebab-case or a blank description skips the skill with a logged error.

The `user-system-prompt` row also serves the owner-only `userSystemPrompt/preview` Remote, which the System prompt page reads to show the current prompt. It renders the unscoped prompt sections on each call, so it includes the saved text but omits sections that agent presets, plan mode, or per-agent tools register in an agent scope. A variable that resolves only inside an agent turn, such as `{{model}}`, stays as written.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Volatile values have no change notification, so the server and skill plugins compare the saved list snapshot with the last applied one on a timer and reconcile only after a write. The system prompt section reads its value at each assembly instead.

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Global system prompt section at the `USER_SYSTEM_PROMPT` order and the `userSystemPrompt` preview Remote |
| [`src/types.ts`](src/types.ts) | The preview Remote's result type |
| [`src/mcp-servers.ts`](src/mcp-servers.ts) | Server list reconciliation over `dsh-mcp-client` children |
| [`src/skills.ts`](src/skills.ts) | Skill list registration into the skill registry |

</details>

## Model Experience

### The user system prompt section

#### What the model sees

The `user-system-prompt` section at order `100`, right after the deployment persona, carries the saved text literally: `{{...}}` is not a prompt variable here. Blank text adds no section. MCP server tools and instructions and the user's skills reach the model through `dsh-mcp-client` and the skill catalog.

##### `user-system-prompt` section

```markdown
<the text saved on the System prompt page, with surrounding whitespace removed>
```

#### Token effect

The saved text's tokens on every request of every agent; none while it is blank. Each enabled server adds its tool schemas, and each enabled skill adds one catalog entry.

#### KV Cache effect

Prefix-stable while the saved text, server list, and skill list are unchanged. Editing the system prompt changes the early prefix after the persona; adding or removing servers or skills changes the tool and catalog portions.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Saved lists apply within one poll interval**: a server or skill edit takes effect up to `pollIntervalMs` after the save.
- **Secrets are stored as plain settings**: environment variables and headers are saved in the profile patch; use them only for values the user accepts storing there.
- **Skills are single documents**: a skill written here has no bundled resource files; skills that need files belong in `~/.dsh/skills` or `~/.agents/skills`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
