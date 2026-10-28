/** Types the `userSystemPrompt` Remote returns. */

/** The current global system prompt as the settings page shows it. */
export interface UserSystemPromptPreview {
  /**
   * Rendered unscoped prompt sections joined with blank lines. Agent-scoped sections
   * (agent presets, plan mode, per-agent tools) are absent; a section whose variables
   * are unresolved without a model selection keeps its `{{variable}}` text.
   */
  text: string
}
