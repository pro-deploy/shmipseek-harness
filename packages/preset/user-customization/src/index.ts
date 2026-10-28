/**
 * The user's global system prompt, edited from the client settings page. Its text joins
 * every agent's system prompt right after the deployment persona; each prompt assembly
 * reads the current value, so a saved edit applies to the next model request.
 *
 * Sibling entries `./mcp-servers` and `./skills` hold the user's MCP servers and skills.
 *
 * @module @deepseek-ai/dsh-user-customization
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { renderPrompt, type AssembledSection, type PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { UserSystemPromptPreview } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Read-only view of the current global system prompt for the settings page. */
    userSystemPrompt: UserSystemPromptGateway
  }
}

/** Remote-only service rendering the current unscoped system prompt for the settings page. */
export class UserSystemPromptGateway extends TypertRemoteService {
  /** @param ctx - a context carrying the prompt registry. */
  constructor(ctx: Context) {
    super(ctx, 'userSystemPrompt')
  }

  /**
   * Assemble and render the unscoped prompt on every call, so a saved edit shows immediately.
   * @returns the rendered prompt text.
   */
  @Remote('preview')
  async preview(): Promise<UserSystemPromptPreview> {
    const assembly = await this.ctx.systemPrompt.assemble()
    return { text: assembly.sections.map(section => renderSection(assembly, section)).filter(text => text.length > 0).join('\n\n') }
  }
}

/**
 * Render one section; a variable that is undefined outside an Agent turn leaves the section literal.
 * @param assembly - the assembly supplying the variables.
 * @param section - the section to render.
 * @returns the rendered or literal section text.
 */
function renderSection(assembly: PromptAssembly, section: AssembledSection): string {
  try {
    return renderPrompt({ ...assembly, sections: [section] })
  } catch {
    // An unresolved variable such as {{model}} only resolves inside an Agent turn; the preview shows the template.
    return section.text
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'user-system-prompt'

/** The prompt registry this plugin contributes to. */
export const inject = ['systemPrompt']

/** Section name of the user's global system prompt. */
export const USER_SYSTEM_PROMPT_SECTION = 'user-system-prompt'

/** Plugin config. */
export interface Config {
  /** The user's instructions; blank contributes nothing. */
  text: Volatile<string>
}

export const Config = z.object({
  text: z.string().default('').volatile(),
})

/**
 * Register the user's section after the deployment persona, and the preview the settings page reads;
 * the user's text is literal, not a prompt template.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.systemPrompt.section({
    name: USER_SYSTEM_PROMPT_SECTION,
    order: ctx.systemPrompt.getSectionOrder('USER_SYSTEM_PROMPT'),
    interpolate: false,
    text: () => config.text.get().trim(),
  }), 'user-system-prompt.section()')
  new UserSystemPromptGateway(ctx)
}
