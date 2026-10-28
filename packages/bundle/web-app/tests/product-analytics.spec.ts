/** The Web and Desktop profiles mount no product telemetry or analytics rows. */
import { fileURLToPath } from 'node:url'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { expect, it } from 'vitest'

const TELEMETRY_ROW_NAMES = [
  '@deepseek-ai/dsh-otel',
  '@deepseek-ai/dsh-host-product-telemetry-otel',
  '@deepseek-ai/dsh-client-product-analytics',
  '@deepseek-ai/dsh-client-ui-settings-session-log',
  '@deepseek-ai/dsh-client-ui-settings-web-search',
]

it('mounts no product telemetry, analytics, or upload settings rows', () => {
  const rows = loadOverlayPatches('analytics', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
    .flatMap(patch => patch.insert ?? [])
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.filter(row => TELEMETRY_ROW_NAMES.includes(String(row.name)))).toEqual([])
})
