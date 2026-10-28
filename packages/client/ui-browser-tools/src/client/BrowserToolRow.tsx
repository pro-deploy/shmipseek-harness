/** Replay-stable chat row for one Desktop browser tool call. */
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconChevronDownOutlineRegular, IconGlobeOutlineRegular, TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { StartedToolCallViewProps, ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { BrowserToolsKey } from './locales.ts'
import css from './BrowserToolRow.module.css'

/** Tool names registered by `@deepseek-ai/dsh-browser-use-desktop`, each mapped to its action label. */
const ACTIONS = {
  browser_tabs: 'action.tabs',
  browser_open: 'action.open',
  browser_navigate: 'action.navigate',
  browser_snapshot: 'action.snapshot',
  browser_click: 'action.click',
  browser_type: 'action.type',
  browser_press: 'action.press',
  browser_scroll: 'action.scroll',
  browser_screenshot: 'action.screenshot',
} as const satisfies Record<string, BrowserToolsKey>

/** Keys of the browser tool rows in the `tool.call.toolview` Slot. */
export const BROWSER_TOOL_NAMES = Object.keys(ACTIONS) as readonly (keyof typeof ACTIONS)[]

type RowState = 'running' | 'ok' | 'error' | 'stopped'
type RowProps = ToolCallViewProps & PropsLocale<'browserTools'>

function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

function shorten(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

/**
 * Derive the call's salient argument from its logged JSON.
 * @param argsRaw - logged or streaming arguments; a truncated prefix yields no detail.
 * @returns address, typed text, key, direction, or element ref, when present.
 */
export function browserCallDetail(argsRaw: string): string | undefined {
  let args: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(argsRaw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    args = parsed as Record<string, unknown>
  } catch {
    // Streaming exposes a truncated JSON prefix until the call completes.
    return undefined
  }
  if (typeof args.url === 'string') {
    if (!URL.canParse(args.url)) return shorten(args.url, 80)
    const url = new URL(args.url)
    return shorten(`${url.host}${url.pathname === '/' ? '' : url.pathname}`, 80)
  }
  if (typeof args.text === 'string') return `«${shorten(firstLine(args.text), 60)}»`
  for (const key of ['history', 'key', 'direction'] as const) {
    if (typeof args[key] === 'string') return args[key]
  }
  if (typeof args.ref === 'number') return `#${String(args.ref)}`
  return undefined
}

function resultText(block: StartedToolCallViewProps['block']): string | null {
  if (!('kind' in block)) return null
  const parts = block.content.flatMap(item => item.type === 'text' ? [item.text] : [])
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n') || null
}

/**
 * Render one browser tool call as a summary line with an expandable result.
 * @param props - keyed toolview payload plus the Browser locale seat.
 * @returns the browser tool row.
 */
export function BrowserToolRow(props: RowProps): ReactNode {
  const action = props.t(Object.hasOwn(ACTIONS, props.toolName) ? ACTIONS[props.toolName as keyof typeof ACTIONS] : 'title')
  if (props.phase === 'preparing') return (
    <div className={css.card} data-tool="browser" data-state="preparing">
      <div className={css.row}>
        <span className={css.leading}><IconGlobeOutlineRegular size={14} /></span>
        <span className={css.visuallyHidden}>{props.t('preparing')}</span>
        <TextShimmer active className={css.title}>{action}</TextShimmer>
      </div>
    </div>
  )
  return <StartedBrowserToolRow {...props} action={action} />
}

function StartedBrowserToolRow({ block, inspect, t, action }: Exclude<RowProps, { phase: 'preparing' }> & { readonly action: string }): ReactNode {
  const [expanded, setExpanded] = useState(false)
  const settled = 'kind' in block
  const state: RowState = !settled ? 'running' : block.error?.code === 'interrupted' ? 'stopped' : block.isError ? 'error' : 'ok'
  const output = resultText(block)
  const detail = browserCallDetail((settled ? block.call?.argsRaw : block.argsRaw) ?? '')
  const summary = state === 'stopped' ? t('stopped')
    : state === 'error' && output !== null ? firstLine(output)
      : detail === undefined ? action : `${action} ${detail}`
  const expandable = output !== null
  const open = expanded && expandable
  const toggle = (): void => { setExpanded(value => !value) }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!expandable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    toggle()
  }
  const status = state === 'running' ? t('running') : state === 'error' ? t('failed') : null
  return (
    <div className={css.card} data-tool="browser" data-state={state}>
      <div className={css.row} data-expandable={expandable || undefined}
        {...expandable ? { role: 'button' as const, tabIndex: 0, 'aria-expanded': open, onClick: toggle, onKeyDown: keyboard } : {}}>
        <span className={css.leading}>{open ? <IconChevronDownOutlineRegular /> : <IconGlobeOutlineRegular size={14} />}</span>
        {status !== null ? <span className={css.visuallyHidden}>{status}</span> : null}
        <TextShimmer active={state === 'running'}>
          <span className={css.title}><TextShimmer>{t('title')}</TextShimmer></span>
          <span className={css.separator} data-shimmer-decoration aria-hidden />
          <span className={css.summary} data-state={state}><TextShimmer>{summary}</TextShimmer></span>
        </TextShimmer>
      </div>
      {open ? <>
        <pre className={css.output} data-state={state} aria-label={t('output')}>{output}</pre>
        {inspect !== undefined ? <button type="button" className={css.inspect} onClick={inspect}>{t('inspect')}</button> : null}
      </> : null}
    </div>
  )
}
