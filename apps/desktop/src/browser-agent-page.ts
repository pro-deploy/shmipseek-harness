/**
 * Scripts the main process runs in a Sidebar guest for agent browser commands.
 * They run in a dedicated isolated world: the page shares the DOM with them but cannot
 * read or replace their globals. The Host program has no DOM types, so the scripts are text.
 */

/** Isolated-world id reserved for agent page scripts. */
export const AGENT_WORLD_ID = 1009

/** Page facts collected by {@link snapshotScript}. */
export interface AgentPageSnapshot {
  readonly title: string
  readonly text: string
  readonly textTruncated: boolean
  readonly elements: readonly {
    readonly ref: number
    readonly role: string
    readonly name: string
    readonly value?: string
    readonly checked?: boolean
    readonly disabled?: boolean
    readonly inView: boolean
  }[]
  readonly elementsTruncated: boolean
  readonly scroll: { readonly top: number; readonly height: number; readonly viewport: number }
}

/** Viewport point and field facts collected by {@link targetScript}. */
export type AgentPageTarget =
  | { readonly found: false }
  | { readonly found: true; readonly x: number; readonly y: number; readonly editable: boolean; readonly secret: boolean }

// The isolated world's global survives for one document, so refs stay valid until navigation.
const STATE = 'const state = (globalThis.__dshAgentPage ??= { next: 1, byRef: new Map(), refs: new WeakMap() });'

/**
 * @param maxTextChars - page-text bound.
 * @param maxElements - element bound; in-view elements are listed first.
 * @returns script whose value is an {@link AgentPageSnapshot}.
 */
export function snapshotScript(maxTextChars: number, maxElements: number): string {
  return `(() => {
${STATE}
const SELECTOR = 'a[href],button,input:not([type=hidden]),textarea,select,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=option],[role=switch],[role=combobox],[role=textbox],[role=searchbox],[role=slider],[role=spinbutton],[contenteditable=""],[contenteditable=true],[tabindex]:not([tabindex="-1"])';
const clean = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
const short = (value) => { const text = clean(value); return text.length > 120 ? text.slice(0, 119) + '…' : text; };
const width = innerWidth, height = innerHeight;
const roleOf = (el) => {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.split(' ')[0];
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'summary') return 'button';
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
    if (type === 'checkbox' || type === 'radio') return type;
    if (type === 'range') return 'slider';
    if (type === 'number') return 'spinbutton';
    if (type === 'search') return 'searchbox';
    if (type === 'password') return 'password';
    return 'textbox';
  }
  if (el.isContentEditable) return 'textbox';
  return tag;
};
const nameOf = (el) => {
  const labelled = el.getAttribute('aria-labelledby');
  const fromIds = labelled ? labelled.split(/\\s+/).map((id) => document.getElementById(id)?.innerText ?? '').join(' ') : '';
  const fromLabel = el.labels && el.labels.length > 0 ? el.labels[0].innerText : '';
  const own = el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) ? el.value : el.innerText;
  for (const candidate of [el.getAttribute('aria-label'), fromIds, fromLabel, el.getAttribute('alt'), own,
    el.getAttribute('title'), el.getAttribute('placeholder'), el.querySelector?.('img[alt]')?.getAttribute('alt'), el.getAttribute('name')]) {
    const text = short(candidate);
    if (text) return text;
  }
  return '';
};
const visible = (el) => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return undefined;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return undefined;
  return rect;
};
const inView = [], offscreen = [];
for (const el of document.querySelectorAll(SELECTOR)) {
  if (el.closest('[aria-hidden="true"]')) continue;
  const rect = visible(el);
  if (rect === undefined) continue;
  (rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width ? inView : offscreen).push(el);
}
const all = inView.map((el) => [el, true]).concat(offscreen.map((el) => [el, false]));
const elements = all.slice(0, ${String(maxElements)}).map(([el, shown]) => {
  let ref = state.refs.get(el);
  if (ref === undefined) { ref = state.next++; state.refs.set(el, ref); state.byRef.set(ref, el); }
  const role = roleOf(el);
  const entry = { ref, role, name: nameOf(el), inView: shown };
  if (role !== 'password' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file'].includes(el.type)) entry.value = short(el.value);
  if (el.tagName === 'SELECT') entry.value = short(el.selectedOptions[0]?.innerText ?? '');
  if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) entry.checked = el.checked;
  else if (el.hasAttribute('aria-checked')) entry.checked = el.getAttribute('aria-checked') === 'true';
  if (el.disabled === true || el.getAttribute('aria-disabled') === 'true') entry.disabled = true;
  return entry;
});
const text = String(document.body?.innerText ?? '').replace(/[ \\t\\u00a0]+/g, ' ').replace(/\\s*\\n\\s*/g, '\\n').trim();
const scroller = document.scrollingElement ?? document.documentElement;
return {
  title: document.title,
  text: text.slice(0, ${String(maxTextChars)}),
  textTruncated: text.length > ${String(maxTextChars)},
  elements,
  elementsTruncated: all.length > ${String(maxElements)},
  scroll: { top: scroller.scrollTop, height: scroller.scrollHeight, viewport: height },
};
})()`
}

/**
 * @param ref - element ref from a snapshot of this document.
 * @returns script that scrolls the element to the viewport center and whose value is an {@link AgentPageTarget}.
 */
export function targetScript(ref: number): string {
  return `(() => {
${STATE}
const el = state.byRef.get(${String(ref)});
if (el === undefined || !el.isConnected) return { found: false };
el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
const rect = el.getBoundingClientRect();
const x = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
const y = Math.min(Math.max(rect.top + rect.height / 2, 1), innerHeight - 1);
const tag = el.tagName;
const type = tag === 'INPUT' ? el.type : '';
const editable = el.isContentEditable || tag === 'TEXTAREA' || (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color'].includes(type));
const secret = type === 'password' || el.getAttribute('autocomplete') === 'one-time-code';
return { found: true, x, y, editable, secret };
})()`
}

/**
 * @param ref - element ref of a focused text field.
 * @returns script that selects the field's whole value so inserted text replaces it.
 */
export function selectAllScript(ref: number): string {
  return `(() => {
${STATE}
const el = state.byRef.get(${String(ref)});
if (el === undefined || !el.isConnected) return false;
el.focus();
if (typeof el.select === 'function') { el.select(); return true; }
const range = document.createRange();
range.selectNodeContents(el);
const selection = getSelection();
selection.removeAllRanges();
selection.addRange(range);
return true;
})()`
}

/**
 * @param direction - scroll direction.
 * @param ref - element to bring into view instead of scrolling by a screen.
 * @returns script that scrolls the element, or the scrollable area under the viewport center by most of its height.
 */
export function scrollScript(direction: 'up' | 'down', ref: number | undefined): string {
  return `(() => {
${STATE}
if (${ref === undefined ? 'false' : 'true'}) {
  const el = state.byRef.get(${String(ref ?? 0)});
  if (el === undefined || !el.isConnected) return false;
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  return true;
}
let target = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
while (target && target !== document.body && target !== document.documentElement) {
  const overflow = getComputedStyle(target).overflowY;
  if ((overflow === 'auto' || overflow === 'scroll') && target.scrollHeight > target.clientHeight) break;
  target = target.parentElement;
}
if (!target || target === document.body || target === document.documentElement) target = document.scrollingElement ?? document.documentElement;
const page = target === document.scrollingElement || target === document.documentElement;
target.scrollBy({ top: ${direction === 'down' ? '' : '-'}(page ? innerHeight : target.clientHeight) * 0.8, behavior: 'instant' });
return true;
})()`
}
