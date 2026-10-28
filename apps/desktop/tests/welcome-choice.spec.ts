import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { readContinueWithoutSignIn, writeContinueWithoutSignIn } from '../src/welcome-choice.ts'

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'desktop-welcome-choice-'))
  onTestFinished(() => { rmSync(directory, { recursive: true, force: true }) })
  return directory
}

it('remembers the choice to continue without signing in until it is forgotten', () => {
  const directory = fixture()
  expect(readContinueWithoutSignIn(directory)).toBe(false)
  writeContinueWithoutSignIn(directory, true)
  expect(readContinueWithoutSignIn(directory)).toBe(true)
  writeContinueWithoutSignIn(directory, false)
  expect(readContinueWithoutSignIn(directory)).toBe(false)
  writeContinueWithoutSignIn(directory, false)
  expect(readContinueWithoutSignIn(directory)).toBe(false)
})

it('treats an unreadable record as no choice and reports a failed write without throwing', () => {
  const directory = fixture()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  onTestFinished(() => { warn.mockRestore() })
  mkdirSync(join(directory, 'desktop', 'continue-without-sign-in'), { recursive: true })
  expect(readContinueWithoutSignIn(directory)).toBe(false)
  const file = join(directory, 'file')
  writeFileSync(file, '')
  writeContinueWithoutSignIn(file, true)
  expect(warn).toHaveBeenCalledTimes(2)
})
