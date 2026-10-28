import { BrandWordmark } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'

/**
 * Occupy the sidebar mark slot with nothing: the brand is the text wordmark alone.
 * @param _props - Host-supplied mark presentation, unused.
 * @returns nothing.
 */
export function OfficialBrandMark(_props: SidebarBrandMarkOwnerProps) {
  return null
}

/**
 * Render the text wordmark in the sidebar name slot.
 * @returns the ShmipSeek Harness wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark />
}

/**
 * Render the text wordmark before the blank-session headline, at the requested height.
 * @param props - Host-supplied size and geometry class.
 * @returns the ShmipSeek Harness wordmark.
 */
export function OfficialHeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <BrandWordmark size={Math.round(size * 0.8)} className={className} />
}
