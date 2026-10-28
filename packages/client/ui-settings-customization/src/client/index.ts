/**
 * The customization pages, browser half: the global system prompt, MCP servers, and skills over
 * the `user-system-prompt`, `user-mcp-servers`, and `user-skills` namespaces. Each page registers
 * into the Plugins page's `plugins.item` slot while the Host serves its namespace; the system prompt
 * page also waits for the Host's `userSystemPrompt` Remote, which renders the current prompt.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the Plugins page's SlotMap merge (the 'plugins.item' entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the ctx.remote Context merge carrying the userSystemPrompt namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  CustomizationPageController, MCP_SERVERS_NS, SKILLS_NS, SYSTEM_PROMPT_NS, settingsListField, systemPromptField, type SystemPromptPageFace,
} from './controllers.ts'
import { McpServersPage, SkillsPage, SystemPromptPage } from './pages.tsx'
import { de, en, es, fr, ja, pt, ru, zh, type CustomizationLocaleKey } from './locales.ts'

export type { CustomizationPageProps, SystemPromptPageProps } from './pages.tsx'
export type { CustomizationPageFace, CustomizationPageState, McpServerEntry, SystemPromptPageFace, UserSkillEntry } from './controllers.ts'
export type { CustomizationLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Customization pages copy. */
    'settings.customization': CustomizationLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.customization'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Mount the three customization pages, each while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-settings-customization: dictionaries')
  const t = ctx.locale.bind(NS)
  const pages: { ns: string; order: number; title: CustomizationLocaleKey; spec: SettingsFieldSpec; component: typeof McpServersPage }[] = [
    { ns: MCP_SERVERS_NS, order: 6, title: 'mcpTitle', spec: settingsListField('servers'), component: McpServersPage },
    { ns: SKILLS_NS, order: 7, title: 'skillsTitle', spec: settingsListField('skills'), component: SkillsPage },
  ]
  for (const page of pages) {
    const controller = new CustomizationPageController(ctx.configForms.get(page.ns), page.spec)
    ctx.effect(() => () => { controller.dispose() }, `ui-settings-customization: ${page.ns} form`)
    ctx.effect(() => ctx.configForms.whileServed([page.ns], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
      name: 'plugins.item', id: page.ns, order: page.order, label: () => t(page.title), locale: NS, inject: () => controller.inject(),
    }, page.component))), `ui-settings-customization: ${page.ns} page`)
  }
  // The Host plugin serving this namespace also provides the preview Remote, so the page waits for both.
  ctx.inject(['remote', 'remote.userSystemPrompt'], (scope) => {
    const controller = new CustomizationPageController(scope.configForms.get(SYSTEM_PROMPT_NS), systemPromptField())
    scope.effect(() => () => { controller.dispose() }, `ui-settings-customization: ${SYSTEM_PROMPT_NS} form`)
    const preview = async (): Promise<string> => {
      const result = await scope.remote.userSystemPrompt.preview()
      if (!result.ok) throw new Error(`userSystemPrompt.preview failed: ${result.error.code}: ${result.error.message}`)
      return result.value.text
    }
    const face = (): SystemPromptPageFace => ({ ...controller.inject(), preview })
    scope.effect(() => scope.configForms.whileServed([SYSTEM_PROMPT_NS], () => scope.slots.inject('plugins.item', () => scope.slots.register({
      name: 'plugins.item', id: SYSTEM_PROMPT_NS, order: 5, label: () => t('promptTitle'), locale: NS, inject: face,
    }, SystemPromptPage))), `ui-settings-customization: ${SYSTEM_PROMPT_NS} page`)
  })
}
