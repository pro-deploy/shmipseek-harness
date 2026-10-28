/** The user's choice to use Desktop without signing in, remembered in the shell's own data directory. */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = 'continue-without-sign-in'

/**
 * @param userData - Electron userData directory.
 * @returns whether the user chose to continue without signing in; an unreadable record counts as no choice.
 */
export function readContinueWithoutSignIn(userData: string): boolean {
  try {
    return readFileSync(join(userData, 'desktop', FILE), 'utf8').trim() === '1'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('desktop welcome: the continue-without-sign-in choice could not be read', error)
    }
    return false
  }
}

/**
 * Remember or forget the choice; a write failure only shows the welcome again at the next startup.
 * @param userData - Electron userData directory.
 * @param chosen - whether startup skips the welcome while no sign-in or key is configured.
 */
export function writeContinueWithoutSignIn(userData: string, chosen: boolean): void {
  try {
    const directory = join(userData, 'desktop')
    if (!chosen) { rmSync(join(directory, FILE), { force: true }); return }
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    writeFileSync(join(directory, FILE), '1\n', { mode: 0o600 })
  } catch (error) {
    console.warn('desktop welcome: the continue-without-sign-in choice could not be saved', error)
  }
}
