/**
 * The user's global skills, edited from the client settings page. Each enabled entry is a
 * runtime skill in the global registry layer, so every agent's catalog lists it; a saved
 * list replaces the registered set within one poll interval.
 *
 * @module @deepseek-ai/dsh-user-customization/skills
 */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { isSkillName } from '@deepseek-ai/dsh-skill'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'user-skills'

/** The skill registry the entries register into. */
export const inject = ['skills']

/** One user-defined skill. */
export interface UserSkillEntry {
  /** Kebab-case skill name, unique in the list. */
  name: string
  /** Whether agents can see and load the skill. */
  enabled: boolean
  /** Short routing description shown in the catalog. */
  description: string
  /** Markdown instructions loaded on demand. */
  content: string
}

/** Plugin config. */
export interface Config {
  /** The user's skills in display order. */
  skills: Volatile<UserSkillEntry[]>
  /** How often a saved list is compared with the registered set, in milliseconds. */
  pollIntervalMs: number
}

const Skill: z<UserSkillEntry> = z.object({
  name: z.string().default(''),
  enabled: z.boolean().default(true),
  description: z.string().default(''),
  content: z.string().default(''),
})

export const Config = z.object({
  skills: z.array(Skill).default([]).volatile(),
  pollIntervalMs: z.natural().min(100).required(),
})

/** Register the enabled skills and replace them after each saved change. */
export function apply(ctx: Context, config: Config): void {
  let registered: (() => void)[] = []
  let applied: unknown
  const reconcile = (): void => {
    const skills = config.skills.get()
    if (skills === applied) return
    applied = skills
    for (const dispose of registered) dispose()
    registered = []
    for (const skill of skills) {
      if (!skill.enabled) continue
      if (!isSkillName(skill.name)) { ctx.logger.error('user-skills: skipping %s: the name must be kebab-case', skill.name || '(unnamed)'); continue }
      if (skill.description.trim() === '') { ctx.logger.error('user-skills: skipping %s: a description is required', skill.name); continue }
      registered.push(ctx.skills.register({ name: skill.name, description: skill.description.trim(), content: skill.content, source: 'runtime' }))
    }
  }
  reconcile()
  ctx.effect(() => {
    const timer = setInterval(reconcile, config.pollIntervalMs)
    return () => { clearInterval(timer) }
  }, 'user-skills.poll')
}
