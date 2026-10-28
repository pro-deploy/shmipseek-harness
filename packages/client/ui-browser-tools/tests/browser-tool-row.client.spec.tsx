// @vitest-environment jsdom
/** Browser tool rows derived from logged calls, and their keyed registration with HMR removal. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { StartedToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ToolCallOwnerProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { PartialArguments } from '@deepseek-ai/dsh-util-values'
import { BROWSER_TOOL_NAMES, BrowserToolRow, browserCallDetail } from '../src/client/BrowserToolRow.tsx'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyHost } from '../src/index.ts'
import { en, ru, zh } from '../src/client/locales.ts'

type RowProps = Parameters<typeof BrowserToolRow>[0]

afterEach(cleanup)

function settled(name: string, argsRaw: string, over: Partial<ToolResultNode> = {}): ToolResultNode {
  return {
    kind: 'tool-result', seq: 3, time: 3_000, callId: `call-${name}`, name,
    args: PartialArguments.fromText(argsRaw), call: { name, argsRaw }, callTime: 2_000,
    content: [{ type: 'text', text: 'Tab tab-1: OZON <https://www.ozon.ru/>' }], isError: false, subCalls: [], ...over,
  }
}

function running(name: string, argsRaw: string): StartedToolCall {
  return { phase: 'start' as const, args: PartialArguments.fromText(argsRaw), callId: `call-${name}`, name, argsRaw, turn: 1, step: 1, time: 2_000, subCalls: [] }
}

function props(name: string, block: RowProps['block'], dictionary: Record<string, string> = en, inspect?: () => void): RowProps {
  const owner: ToolCallOwnerProps = {
    callId: block.callId,
    toolName: name,
    ...('kind' in block ? { phase: 'result' as const, block }
      : block.phase === 'preparing' ? { phase: 'preparing' as const, block } : { phase: 'start' as const, block }),
    useDisclosure: () => ({ expanded: false, setExpanded: vi.fn(), toggle: vi.fn() }),
    loadImage: vi.fn<ToolCallOwnerProps['loadImage']>(),
    openFile: vi.fn(),
    inspect,
  }
  return { ...owner, t: makeTranslate(dictionary, commonZh) } as RowProps
}

describe('BrowserToolRow', () => {
  it('summarizes the salient argument of each call', () => {
    expect(browserCallDetail('{"url":"https://www.ozon.ru/search/?text=x"}')).toBe('www.ozon.ru/search/')
    expect(browserCallDetail('{"url":"https://www.ozon.ru/"}')).toBe('www.ozon.ru')
    expect(browserCallDetail('{"ref":4,"text":"наушники\\nвторая строка"}')).toBe('«наушники»')
    expect(browserCallDetail('{"key":"Enter"}')).toBe('Enter')
    expect(browserCallDetail('{"ref":12}')).toBe('#12')
    expect(browserCallDetail('{"url":')).toBeUndefined()
    expect(browserCallDetail('{}')).toBeUndefined()
  })

  it('shows a running action and then its expandable result', () => {
    const view = render(<BrowserToolRow {...props('browser_open', running('browser_open', '{"url":"https://www.ozon.ru/"}'), ru)} />)
    expect(view.container.textContent).toContain('Открыть страницу www.ozon.ru')
    expect(view.container.querySelector('[data-state="running"]')).not.toBeNull()
    view.rerender(<BrowserToolRow {...props('browser_open', settled('browser_open', '{"url":"https://www.ozon.ru/"}'), ru)} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByLabelText('Результат').textContent).toBe('Tab tab-1: OZON <https://www.ozon.ru/>')
  })

  it('shows the first error line for a failed action', () => {
    const failed = settled('browser_click', '{"ref":9}', {
      isError: true, content: [{ type: 'text', text: 'element 9 is not on the current page; take a new snapshot\nmore' }],
    })
    const view = render(<BrowserToolRow {...props('browser_click', failed)} />)
    expect(view.container.querySelector('[data-state="error"]')?.textContent).toContain('element 9 is not on the current page; take a new snapshot')
    expect(view.container.textContent).not.toContain('more')
  })
})

describe('BrowserToolRow states', () => {
  it('shows preparation with only the action', () => {
    const view = render(<BrowserToolRow {...props('browser_scroll', {
      phase: 'preparing', args: PartialArguments.EMPTY, callId: 'call-scroll', name: 'browser_scroll', turn: 1, step: 1, time: 1, subCalls: [],
    })} />)
    expect(view.container.querySelector('[data-state="preparing"]')?.textContent).toContain('Scroll')
    expect(view.queryByRole('button')).toBeNull()
  })

  it('names an interruption, falls back for an unknown tool, and summarizes other arguments', () => {
    const stopped = settled('browser_navigate', '{"history":"back"}', { isError: true, content: [], error: { name: 'InterruptedError', code: 'interrupted' } })
    const view = render(<BrowserToolRow {...props('browser_navigate', stopped)} />)
    expect(view.container.querySelector('span[data-state="stopped"]')?.textContent).toBe('Stopped')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByLabelText('Result').textContent).toBe('InterruptedError: interrupted')
    cleanup()
    const unknown = render(<BrowserToolRow {...props('browser_future', settled('browser_future', '{"direction":"down"}', { content: [] }))} />)
    expect(unknown.container.textContent).toContain('BrowserBrowser down')
    expect(unknown.queryByRole('button')).toBeNull()
    expect(browserCallDetail('{"url":"not an address"}')).toBe('not an address')
    expect(browserCallDetail(`{"text":"${'я'.repeat(70)}"}`)).toBe(`«${'я'.repeat(59)}…»`)
    expect(browserCallDetail('[1]')).toBeUndefined()
    expect(browserCallDetail('null')).toBeUndefined()
    cleanup()
    const image = { type: 'image' as const, attachment: { attachmentId: 'a', mediaType: 'image/png' as const, bytes: 1, width: 1, height: 1 } }
    const orphan = render(<BrowserToolRow {...props('browser_screenshot', settled('browser_screenshot', '{}', {
      call: null, content: [{ type: 'text', text: 'Screenshot, 1x1 px.' }, image] as ToolResultNode['content'] }))} />)
    expect(orphan.container.textContent).toContain('Screenshot')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByLabelText('Result').textContent).toBe('Screenshot, 1x1 px.')
  })

  it('toggles the result from the keyboard and offers inspection', () => {
    const inspect = vi.fn()
    render(<BrowserToolRow {...props('browser_tabs', settled('browser_tabs', '{}'), en, inspect)} />)
    const row = screen.getByRole('button', { expanded: false })
    fireEvent.keyDown(row, { key: 'a' })
    expect(screen.queryByLabelText('Result')).toBeNull()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(screen.getByLabelText('Result')).not.toBeNull()
    fireEvent.click(screen.getByText('Inspect'))
    expect(inspect).toHaveBeenCalledOnce()
    fireEvent.keyDown(screen.getByRole('button', { expanded: true }), { key: ' ' })
    expect(screen.queryByLabelText('Result')).toBeNull()
  })
})

describe('ui-browser-tools apply', () => {
  it('has no Host behavior', () => {
    expect(() => { applyHost() }).not.toThrow()
  })

  it('registers dictionaries and one keyed row per browser tool until unloaded', async () => {
    const ctx = new Context()
    const slots = new SlotRegistry(ctx)
    slots.register({ name: 'root', children: { 'tool.call.toolview': { kind: 'keyed', scope: 'session' } } } as never, () => null)
    const dictionaries = new Map<string, unknown>()
    ctx.provide('locale', {
      register(namespace: string, value: unknown) {
        dictionaries.set(namespace, value)
        return () => { dictionaries.delete(namespace) }
      },
      bind: () => (key: string) => key,
    })
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(dictionaries.get('browserTools')).toMatchObject({ zh, en, ru })
    const entries = slots.entries('tool.call.toolview')
    expect(entries.map(entry => [entry.options.key, entry.locale, entry.component])).toEqual(
      BROWSER_TOOL_NAMES.map(name => [name, 'browserTools', BrowserToolRow]))
    await fiber.dispose()
    expect(dictionaries.size).toBe(0)
    expect(slots.entries('tool.call.toolview')).toEqual([])
    await ctx.fiber.dispose()
  })
})
