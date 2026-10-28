// @vitest-environment jsdom
/** Agent page scripts evaluated against a DOM; layout methods jsdom lacks are stubbed per element. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { scrollScript, selectAllScript, snapshotScript, targetScript, type AgentPageSnapshot } from '../src/browser-agent-page.ts'

const evaluate = (code: string): unknown => (0, eval)(code)

function place(element: Element, top: number, height = 20): void {
  const rect = { top, left: 10, width: 100, height, bottom: top + height, right: 110, x: 10, y: top }
  element.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect })
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get(this: HTMLElement) { return this.textContent } })
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('innerWidth', 1000)
  vi.stubGlobal('innerHeight', 800)
  document.title = 'OZON'
  document.body.innerHTML = `
    <label for="q">Искать на Ozon</label><input id="q" type="search" value="наушники">
    <input id="pw" type="password" value="hunter2">
    <button id="buy">В корзину</button>
    <a id="far" href="/cart">Корзина</a>
    <button id="hidden" style="display:none">Скрыто</button>
    <div aria-hidden="true"><button id="decor">Декор</button></div>
    <p>Беспроводные наушники</p>`
  place(document.getElementById('q')!, 10)
  place(document.getElementById('pw')!, 40)
  place(document.getElementById('buy')!, 70)
  place(document.getElementById('far')!, 2000)
  place(document.getElementById('hidden')!, 100)
  place(document.getElementById('decor')!, 130)
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, '__dshAgentPage')
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

it('lists visible interactive elements with in-view ones first and hides password values', () => {
  const page = evaluate(snapshotScript(1000, 10)) as AgentPageSnapshot
  expect(page.elements).toEqual([
    { ref: 1, role: 'searchbox', name: 'Искать на Ozon', value: 'наушники', inView: true },
    { ref: 2, role: 'password', name: '', inView: true },
    { ref: 3, role: 'button', name: 'В корзину', inView: true },
    { ref: 4, role: 'link', name: 'Корзина', inView: false },
  ])
  expect(page).toMatchObject({ title: 'OZON', elementsTruncated: false, textTruncated: false })
  expect(page.text).toContain('Беспроводные наушники')
  expect(page.text).not.toContain('hunter2')
})

it('keeps refs stable across snapshots of one document and bounds both lists', () => {
  evaluate(snapshotScript(1000, 10))
  const bounded = evaluate(snapshotScript(5, 2)) as AgentPageSnapshot
  expect(bounded.elements.map(element => element.ref)).toEqual([1, 2])
  expect(bounded).toMatchObject({ elementsTruncated: true, textTruncated: true })
  expect(bounded.text).toHaveLength(5)
})

it('locates a ref, classifies secret fields, and reports a removed element', () => {
  evaluate(snapshotScript(1000, 10))
  expect(evaluate(targetScript(1))).toEqual({ found: true, x: 60, y: 20, editable: true, secret: false })
  expect(evaluate(targetScript(2))).toMatchObject({ found: true, editable: true, secret: true })
  expect(evaluate(targetScript(3))).toMatchObject({ found: true, editable: false })
  document.getElementById('buy')!.remove()
  expect(evaluate(targetScript(3))).toEqual({ found: false })
  expect(evaluate(targetScript(99))).toEqual({ found: false })
})

it('selects a field value and scrolls a ref or the page', () => {
  evaluate(snapshotScript(1000, 10))
  const input = document.getElementById('q') as HTMLInputElement
  expect(evaluate(selectAllScript(1))).toBe(true)
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'наушники'.length])
  const intoView = vi.fn()
  document.getElementById('far')!.scrollIntoView = intoView
  expect(evaluate(scrollScript('down', 4))).toBe(true)
  expect(intoView).toHaveBeenCalled()
  const scroller = document.scrollingElement ?? document.documentElement
  const scrollBy = vi.fn()
  scroller.scrollBy = scrollBy
  document.elementFromPoint = () => document.body
  expect(evaluate(scrollScript('up', undefined))).toBe(true)
  expect(scrollBy).toHaveBeenCalledWith({ top: -640, behavior: 'instant' })
  expect(evaluate(scrollScript('down', 77))).toBe(false)
})
