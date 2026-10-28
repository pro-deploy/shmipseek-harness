/** Staged forms over the `user-system-prompt`, `user-mcp-servers`, and `user-skills` namespaces. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel, settingsTextField,
  type SettingsFieldSpec, type SettingsFieldState, type SettingsFormActions, type SettingsFormScope, type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Namespace of the global system prompt. Namespaces are spelled here rather than imported:
 * a client package must not depend on a Host package.
 */
export const SYSTEM_PROMPT_NS = 'user-system-prompt'
/** Namespace of the user's MCP server list. */
export const MCP_SERVERS_NS = 'user-mcp-servers'
/** Namespace of the user's skill list. */
export const SKILLS_NS = 'user-skills'

/** One MCP server as the `user-mcp-servers` namespace stores it. */
export interface McpServerEntry {
  name: string
  enabled: boolean
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string[]
  env: Record<string, string>
  url: string
  headers: Record<string, string>
}

/** One skill as the `user-skills` namespace stores it. */
export interface UserSkillEntry {
  name: string
  enabled: boolean
  description: string
  content: string
}

/** What one customization page renders: the form shell plus its single staged field. */
export interface CustomizationPageState extends SettingsFormShell {
  /** The staged field; list pages carry their list as JSON text. */
  field: SettingsFieldState
}

/** The registration-side face one page's slot entry injects. */
export interface CustomizationPageFace extends SettingsFormActions {
  hooks: {
    /** Page snapshot bound by the renderer as useCustomizationPage. */
    customizationPage: SnapshotStore<CustomizationPageState>
  }
}

/** The system prompt page's face: the staged form plus the Host's rendered current prompt. */
export interface SystemPromptPageFace extends CustomizationPageFace {
  /**
   * Read the current unscoped system prompt from the Host.
   * @returns the rendered prompt text; rejects when the Host call fails.
   */
  preview: () => Promise<string>
}

/**
 * A field whose staged text is the JSON of a list; an unparseable draft is invalid.
 * @param field - the namespace field holding the list.
 * @returns the spec that formats the stored list and parses a staged draft.
 */
export function settingsListField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => JSON.stringify(Array.isArray(value) ? value : []),
    parse: (text) => {
      try {
        const value: unknown = JSON.parse(text)
        return Array.isArray(value) ? { kind: 'set', value } : undefined
      } catch {
        // A draft that is not JSON never leaves the page; the field reports it invalid.
        return undefined
      }
    },
  }
}

/** Bridges one namespace onto its page's staged single-field form. */
export class CustomizationPageController<T> {
  private readonly form: SettingsFormModel<T>
  private readonly store: SnapshotStore<CustomizationPageState>

  /**
   * @param scope - the bound settings scope for the page's namespace.
   * @param spec - how the page's one field is formatted and parsed.
   */
  constructor(scope: SettingsFormScope<T>, private readonly spec: SettingsFieldSpec) {
    this.form = new SettingsFormModel(scope, [spec])
    this.store = this.form.bind(() => ({ ...this.form.shell(), field: this.form.field(this.spec.field) }))
  }

  /**
   * Build the face the page's slot registration injects.
   * @returns the page's snapshot and its form actions.
   */
  inject(): CustomizationPageFace {
    return { hooks: { customizationPage: this.store }, ...this.form.actions() }
  }

  /** Release accepted-value subscriptions. */
  dispose(): void { this.form.dispose() }
}

/**
 * The system prompt page's field: blank clears the user's text back to none.
 * @returns the text field spec for `text`.
 */
export const systemPromptField = (): SettingsFieldSpec => settingsTextField('text')
