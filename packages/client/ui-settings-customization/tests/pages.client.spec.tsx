// @vitest-environment jsdom
/** The customization pages as the Plugins page renders them. */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import { McpServersPage, SkillsPage, SystemPromptPage, type CustomizationPageProps, type SystemPromptPageProps } from '../src/client/pages.tsx'
import type { CustomizationPageState } from '../src/client/controllers.ts'
import { emptyServer } from '../src/client/entries.ts'
import { en } from '../src/client/locales.ts'
import type {} from '../src/client/index.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]
const settled: SettingsFormShell = { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }

function renderPage(
  Page: (props: CustomizationPageProps & SystemPromptPageProps) => unknown, text: string, view: 'summary' | 'page' = 'page',
  preview: () => Promise<string> = () => Promise.resolve('Built-in prompt.'),
) {
  const store = createSnapshotStore<CustomizationPageState>({ ...settled, field: { text, overridden: false, invalid: false } })
  const actions = { edit: vi.fn(), resetField: vi.fn(), save: vi.fn(), discard: vi.fn() }
  type PageProps = CustomizationPageProps & SystemPromptPageProps
  const props = { ...actions, view, t, preview, useCustomizationPage: bindSnapshotSelector(store) } as PageProps
  const Component = Page as (props: PageProps) => React.JSX.Element
  render(<Component {...props} />)
  return actions
}

describe('customization pages', () => {
  it('shows each one-liner in the summary view', () => {
    renderPage(SystemPromptPage, '', 'summary')
    expect(document.body.textContent).toBe(en.promptDescription)
  })

  it('stages the system prompt text', () => {
    const actions = renderPage(SystemPromptPage, 'Old.')
    fireEvent.change(screen.getByLabelText(en.promptLabel), { target: { value: 'Answer in Russian.' } })
    expect(actions.edit).toHaveBeenCalledWith('text', 'Answer in Russian.')
  })

  it('shows the current prompt the Host renders and reads it again on refresh', async () => {
    const preview = vi.fn<() => Promise<string>>()
      .mockResolvedValueOnce('Built-in prompt.')
      .mockResolvedValueOnce('Built-in prompt.\n\nMine.')
    renderPage(SystemPromptPage, '', 'page', preview)
    const current = screen.getByLabelText<HTMLTextAreaElement>(en.promptCurrentLabel)
    await waitFor(() => { expect(current.value).toBe('Built-in prompt.') })
    expect(current.readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en.promptCurrentRefresh }))
    await waitFor(() => { expect(current.value).toBe('Built-in prompt.\n\nMine.') })
    expect(preview).toHaveBeenCalledTimes(2)
  })

  it('reports a current prompt the Host could not render', async () => {
    renderPage(SystemPromptPage, '', 'page', () => Promise.reject(new Error('offline')))
    expect(await screen.findByText(en.promptCurrentFailed)).toBeTruthy()
  })

  it('shows an example in every editable field', () => {
    renderPage(SystemPromptPage, '')
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.promptLabel).placeholder).toBe(en.promptPlaceholder)
    cleanup()
    renderPage(McpServersPage, JSON.stringify([{ ...emptyServer(), name: 'files' }]))
    expect(screen.getByLabelText<HTMLInputElement>(en.mcpName).placeholder).toBe(en.mcpNamePlaceholder)
    expect(screen.getByLabelText<HTMLInputElement>(en.mcpCommand).placeholder).toBe(en.mcpCommandPlaceholder)
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.mcpArgs).placeholder).toBe(en.mcpArgsPlaceholder)
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.mcpEnv).placeholder).toBe(en.mcpEnvPlaceholder)
    fireEvent.click(screen.getByRole('button', { name: en.mcpImport }))
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.mcpImportLabel).placeholder).toBe(en.mcpImportPlaceholder)
    cleanup()
    renderPage(McpServersPage, JSON.stringify([{ ...emptyServer(), name: 'web', transport: 'streamable-http' }]))
    expect(screen.getByLabelText<HTMLInputElement>(en.mcpUrl).placeholder).toBe(en.mcpUrlPlaceholder)
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.mcpHeaders).placeholder).toBe(en.mcpHeadersPlaceholder)
    cleanup()
    renderPage(SkillsPage, JSON.stringify([{ name: '', enabled: true, description: '', content: '' }]))
    expect(screen.getByLabelText<HTMLInputElement>(en.skillName).placeholder).toBe(en.skillNamePlaceholder)
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.skillDescription).placeholder).toBe(en.skillDescriptionPlaceholder)
    expect(screen.getByLabelText<HTMLTextAreaElement>(en.skillContent).placeholder).toBe(en.skillContentPlaceholder)
  })

  it('adds, edits, and imports MCP servers as one staged JSON list', () => {
    const actions = renderPage(McpServersPage, JSON.stringify([{ ...emptyServer(), name: 'files', command: 'npx' }]))
    fireEvent.change(screen.getByLabelText(en.mcpArgs), { target: { value: '-y\nserver-files' } })
    expect(JSON.parse(actions.edit.mock.lastCall![1] as string)).toEqual([{ ...emptyServer(), name: 'files', command: 'npx', args: ['-y', 'server-files'] }])
    fireEvent.click(screen.getByRole('button', { name: en.mcpAdd }))
    expect(JSON.parse(actions.edit.mock.lastCall![1] as string)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: en.mcpImport }))
    fireEvent.change(screen.getByLabelText(en.mcpImportLabel), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: en.mcpImportApply }))
    expect(screen.getByText(en.mcpImportInvalid)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(en.mcpImportLabel), { target: { value: '{"mcpServers": {"web": {"url": "http://127.0.0.1:3000/mcp"}}}' } })
    fireEvent.click(screen.getByRole('button', { name: en.mcpImportApply }))
    const imported = JSON.parse(actions.edit.mock.lastCall![1] as string) as { name: string }[]
    expect(imported.map(server => server.name)).toEqual(['files', 'web'])
  })

  it('flags an invalid server name and removes a server', () => {
    const actions = renderPage(McpServersPage, JSON.stringify([{ ...emptyServer(), name: 'bad name', command: 'x' }]))
    expect(screen.getByText(en.mcpNameInvalid)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.mcpRemove }))
    expect(actions.edit).toHaveBeenCalledWith('servers', '[]')
  })

  it('adds and edits skills', () => {
    const actions = renderPage(SkillsPage, '[]')
    expect(screen.getByText(en.skillsEmpty)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.skillsAdd }))
    expect(JSON.parse(actions.edit.mock.lastCall![1] as string)).toEqual([{ name: '', enabled: true, description: '', content: '' }])
    cleanup()
    const edited = renderPage(SkillsPage, JSON.stringify([{ name: 'review', enabled: true, description: '', content: '' }]))
    fireEvent.change(screen.getByLabelText(en.skillDescription), { target: { value: 'Review code.' } })
    const skills = JSON.parse(edited.edit.mock.lastCall![1] as string) as { description: string }[]
    expect(skills[0]!.description).toBe('Review code.')
  })
})
