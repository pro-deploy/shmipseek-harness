/** The customization pages: global system prompt, MCP servers, and skills. */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { Button, SegmentedControl, SettingsForm, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { CustomizationPageFace, McpServerEntry, SystemPromptPageFace, UserSkillEntry } from './controllers.ts'
import {
  emptyServer, emptySkill, importMcpServers, linesOf, listOf, mergeServers, pairsOf, pairsText, serverNameValid, skillNameValid,
} from './entries.ts'
import { formLabels } from './locales.ts'
import css from './pages.module.css'

/** Props the renderer binds for each customization page. */
export type CustomizationPageProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'settings.customization'>
  & InjectFace<CustomizationPageFace>

/** Props the renderer binds for the system prompt page. */
export type SystemPromptPageProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'settings.customization'>
  & InjectFace<SystemPromptPageFace>

/**
 * A labelled multi-line control with its hint or error line.
 * @param props - id, copy, value, and change handler.
 * @returns the field.
 */
function TextAreaField(props: {
  id: string
  label: string
  hint: string
  placeholder: string
  value: string
  disabled: boolean
  tall?: boolean
  error?: string | undefined
  onChange: (text: string) => void
}) {
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor={props.id}>{props.label}</label>
      <textarea
        id={props.id}
        className={clsx(css.textarea, props.tall === true && css.tall)}
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        spellCheck={false}
        {...props.error === undefined ? {} : { 'aria-invalid': true }}
        onChange={(event) => { props.onChange(event.target.value) }}
      />
      {props.error === undefined
        ? <p className={css.hint}>{props.hint}</p>
        : <p className={css.invalid}>{props.error}</p>}
    </div>
  )
}

/**
 * A labelled single-line control with an optional error line.
 * @param props - id, copy, value, and change handler.
 * @returns the field.
 */
function InputField(props: {
  id: string
  label: string
  placeholder: string
  value: string
  disabled: boolean
  error?: string | undefined
  onChange: (text: string) => void
}) {
  return (
    <div className={css.field}>
      <label className={css.label} htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className={css.input}
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        spellCheck={false}
        {...props.error === undefined ? {} : { 'aria-invalid': true }}
        onChange={(event) => { props.onChange(event.target.value) }}
      />
      {props.error === undefined ? null : <p className={css.invalid}>{props.error}</p>}
    </div>
  )
}

/** The Host's rendered prompt as the page last read it. */
type PreviewState = { kind: 'loading' } | { kind: 'ready'; text: string } | { kind: 'failed' }

/**
 * The global system prompt page: the editable user text, then the current prompt the Host renders.
 * @param props - view, copy, the staged form, and the preview reader.
 * @returns the one-liner, or the editor.
 */
export function SystemPromptPage(props: SystemPromptPageProps) {
  const { t, preview } = props
  const state = props.useCustomizationPage(snapshot => snapshot)
  const [current, setCurrent] = useState<PreviewState>({ kind: 'loading' })
  const [generation, setGeneration] = useState(0)
  const summary = props.view === 'summary'
  // A finished save changes the Host's prompt, so the read repeats whenever saving settles.
  useEffect(() => {
    if (summary || state.saving) return
    let live = true
    setCurrent({ kind: 'loading' })
    preview().then(
      (text) => { if (live) setCurrent({ kind: 'ready', text }) },
      () => { if (live) setCurrent({ kind: 'failed' }) },
    )
    return () => { live = false }
  }, [summary, state.saving, generation, preview])
  if (summary) return t('promptDescription')
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      <TextAreaField
        id="customization-system-prompt"
        label={t('promptLabel')}
        hint={t('promptHint')}
        placeholder={t('promptPlaceholder')}
        value={state.field.text}
        disabled={!state.writable}
        tall
        onChange={(text) => { props.edit('text', text) }}
      />
      <div className={css.field}>
        <label className={css.label} htmlFor="customization-system-prompt-current">{t('promptCurrentLabel')}</label>
        <textarea
          id="customization-system-prompt-current"
          className={clsx(css.textarea, css.tall)}
          readOnly
          spellCheck={false}
          value={current.kind === 'ready' ? current.text : ''}
          placeholder={current.kind === 'loading' ? t('promptCurrentLoading') : current.kind === 'failed' ? '' : t('promptCurrentEmpty')}
        />
        {current.kind === 'failed'
          ? <p className={css.invalid}>{t('promptCurrentFailed')}</p>
          : <p className={css.hint}>{t('promptCurrentHint')}</p>}
        <div className={css.actions}>
          <Button variant="ghost" size="sm" disabled={current.kind === 'loading'} onClick={() => { setGeneration(generation + 1) }}>
            {t('promptCurrentRefresh')}
          </Button>
        </div>
      </div>
    </SettingsForm>
  )
}

/**
 * Edit one stdio or URL server; free-text list fields keep their draft until the user leaves them.
 * @param props - the entry, its validity, copy, and change handlers.
 * @returns the server card.
 */
function ServerCard(props: {
  index: number
  server: McpServerEntry
  nameValid: boolean
  disabled: boolean
  t: CustomizationPageProps['t']
  onChange: (next: McpServerEntry) => void
  onRemove: () => void
}) {
  const { index, server, t, disabled } = props
  const [argsText, setArgsText] = useState(() => server.args.join('\n'))
  const [envText, setEnvText] = useState(() => pairsText(server.env, '='))
  const [headersText, setHeadersText] = useState(() => pairsText(server.headers, ':'))
  const id = (field: string) => `customization-mcp-${String(index)}-${field}`
  return (
    <li className={css.card}>
      <div className={css.cardHead}>
        <InputField
          id={id('name')} label={t('mcpName')} placeholder={t('mcpNamePlaceholder')} value={server.name} disabled={disabled}
          error={props.nameValid ? undefined : t('mcpNameInvalid')}
          onChange={(name) => { props.onChange({ ...server, name: name.trim() }) }}
        />
        <Switch
          checked={server.enabled} label={t('mcpEnabled')} disabled={disabled}
          onChange={(enabled) => { props.onChange({ ...server, enabled }) }}
        />
      </div>
      <div className={css.field}>
        <span className={css.label}>{t('mcpTransport')}</span>
        <SegmentedControl
          id={id('transport')} label={t('mcpTransport')} value={server.transport} disabled={disabled}
          options={[{ value: 'stdio', label: t('mcpTransportStdio') }, { value: 'streamable-http', label: t('mcpTransportHttp') }]}
          onChange={(transport) => { props.onChange({ ...server, transport }) }}
        />
      </div>
      {server.transport === 'stdio'
        ? (
          <>
            <InputField
              id={id('command')} label={t('mcpCommand')} placeholder={t('mcpCommandPlaceholder')} value={server.command} disabled={disabled}
              onChange={(command) => { props.onChange({ ...server, command }) }}
            />
            <TextAreaField
              id={id('args')} label={t('mcpArgs')} hint={t('mcpArgsHint')} placeholder={t('mcpArgsPlaceholder')} value={argsText} disabled={disabled}
              onChange={(text) => { setArgsText(text); props.onChange({ ...server, args: linesOf(text) }) }}
            />
            <TextAreaField
              id={id('env')} label={t('mcpEnv')} hint={t('mcpEnvHint')} placeholder={t('mcpEnvPlaceholder')} value={envText} disabled={disabled}
              onChange={(text) => { setEnvText(text); props.onChange({ ...server, env: pairsOf(text, '=') }) }}
            />
          </>
        )
        : (
          <>
            <InputField
              id={id('url')} label={t('mcpUrl')} placeholder={t('mcpUrlPlaceholder')} value={server.url} disabled={disabled}
              onChange={(url) => { props.onChange({ ...server, url }) }}
            />
            <TextAreaField
              id={id('headers')} label={t('mcpHeaders')} hint={t('mcpHeadersHint')} placeholder={t('mcpHeadersPlaceholder')} value={headersText} disabled={disabled}
              onChange={(text) => { setHeadersText(text); props.onChange({ ...server, headers: pairsOf(text, ':') }) }}
            />
          </>
        )}
      <div className={css.actions}>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={props.onRemove}>{t('mcpRemove')}</Button>
      </div>
    </li>
  )
}

/**
 * The MCP servers page: a staged list with add, remove, and JSON import.
 * @param props - view, copy, and the staged form.
 * @returns the one-liner, or the editor.
 */
export function McpServersPage(props: CustomizationPageProps) {
  const { t } = props
  const state = props.useCustomizationPage(snapshot => snapshot)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importInvalid, setImportInvalid] = useState(false)
  // Each card's free-text drafts live in the card; a new generation remounts them after a discard or import.
  const [generation, setGeneration] = useState(0)
  if (props.view === 'summary') return t('mcpDescription')
  const servers = listOf<McpServerEntry>(state.field.text)
  const disabled = !state.writable
  const write = (next: McpServerEntry[]) => { props.edit('servers', JSON.stringify(next)) }
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save}
      onDiscard={() => { props.discard(); setGeneration(generation + 1) }}>
      {servers.length === 0 ? <p className={css.empty}>{t('mcpEmpty')}</p> : null}
      <ul className={css.list}>
        {servers.map((server, index) => (
          <ServerCard
            key={`${String(generation)}-${String(index)}`} index={index} server={server} disabled={disabled} t={t}
            nameValid={serverNameValid(servers, index)}
            onChange={(next) => { write(servers.map((entry, at) => at === index ? next : entry)) }}
            onRemove={() => { write(servers.filter((_, at) => at !== index)); setGeneration(generation + 1) }}
          />
        ))}
      </ul>
      <div className={css.actions}>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => { write([...servers, emptyServer()]) }}>{t('mcpAdd')}</Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { setImportOpen(!importOpen) }}>{t('mcpImport')}</Button>
      </div>
      {importOpen
        ? (
          <>
            <TextAreaField
              id="customization-mcp-import" label={t('mcpImportLabel')} hint={t('mcpImportHint')} placeholder={t('mcpImportPlaceholder')} value={importText} disabled={disabled}
              error={importInvalid ? t('mcpImportInvalid') : undefined}
              onChange={(text) => { setImportText(text); setImportInvalid(false) }}
            />
            <div className={css.actions}>
              <Button variant="outline" size="sm" disabled={disabled || importText.trim() === ''} onClick={() => {
                const imported = importMcpServers(importText)
                if (imported === undefined) { setImportInvalid(true); return }
                write(mergeServers(servers, imported))
                setGeneration(generation + 1)
                setImportText('')
                setImportOpen(false)
              }}>{t('mcpImportApply')}</Button>
            </div>
          </>
        )
        : null}
    </SettingsForm>
  )
}

/**
 * The skills page: a staged list of named Markdown instructions.
 * @param props - view, copy, and the staged form.
 * @returns the one-liner, or the editor.
 */
export function SkillsPage(props: CustomizationPageProps) {
  const { t } = props
  const state = props.useCustomizationPage(snapshot => snapshot)
  if (props.view === 'summary') return t('skillsDescription')
  const skills = listOf<UserSkillEntry>(state.field.text)
  const disabled = !state.writable
  const write = (next: UserSkillEntry[]) => { props.edit('skills', JSON.stringify(next)) }
  const update = (index: number, patch: Partial<UserSkillEntry>) => {
    write(skills.map((entry, at) => at === index ? { ...entry, ...patch } : entry))
  }
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      {skills.length === 0 ? <p className={css.empty}>{t('skillsEmpty')}</p> : null}
      <ul className={css.list}>
        {skills.map((skill, index) => (
          <li key={String(index)} className={css.card}>
            <div className={css.cardHead}>
              <InputField
                id={`customization-skill-${String(index)}-name`} label={t('skillName')} placeholder={t('skillNamePlaceholder')} value={skill.name} disabled={disabled}
                error={skillNameValid(skills, index) ? undefined : t('skillNameInvalid')}
                onChange={(name) => { update(index, { name: name.trim() }) }}
              />
              <Switch checked={skill.enabled} label={t('skillEnabled')} disabled={disabled}
                onChange={(enabled) => { update(index, { enabled }) }} />
            </div>
            <TextAreaField
              id={`customization-skill-${String(index)}-description`} label={t('skillDescription')} hint={t('skillDescriptionHint')}
              placeholder={t('skillDescriptionPlaceholder')}
              value={skill.description} disabled={disabled}
              onChange={(description) => { update(index, { description }) }}
            />
            <TextAreaField
              id={`customization-skill-${String(index)}-content`} label={t('skillContent')} hint={t('skillContentHint')}
              placeholder={t('skillContentPlaceholder')}
              value={skill.content} disabled={disabled} tall
              onChange={(content) => { update(index, { content }) }}
            />
            <div className={css.actions}>
              <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { write(skills.filter((_, at) => at !== index)) }}>{t('skillRemove')}</Button>
            </div>
          </li>
        ))}
      </ul>
      <div className={css.actions}>
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => { write([...skills, emptySkill()]) }}>{t('skillsAdd')}</Button>
      </div>
    </SettingsForm>
  )
}
