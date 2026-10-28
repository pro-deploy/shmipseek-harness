import type { IconProps } from './icons/props.ts'

/** Display options for the official brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Accepted for existing callers; the text wordmark has no separate mark. */
  includeMark?: boolean | undefined
}

/** Heavy serif stack shared by the name and the badge. */
const WORDMARK_FONT = 'Georgia, "Times New Roman", serif'

/** Product name and badge letters; brand art, identical in every locale. */
const WORDMARK_NAME = 'ShmipSeek'
const WORDMARK_BADGE = 'HARNESS'

/**
 * Render the text wordmark: "ShmipSeek" in the label colour followed by "HARNESS" in
 * inverted letters on a label-coloured badge.
 * @param props.size - height in px (default 24; width keeps the 182:24 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: BrandWordmarkProps) {
  return (
    <svg
      width={(size * 182) / 24}
      height={size}
      className={className}
      viewBox="0 0 182 24"
      fill="none"
      aria-hidden="true"
    >
      <text
        x="0" y="18.5" textLength="104" lengthAdjust="spacingAndGlyphs"
        fontFamily={WORDMARK_FONT} fontSize="19" fontWeight="900" fill="currentColor"
      >{WORDMARK_NAME}</text>
      <rect x="113" y="3.5" width="69" height="17" rx="2" fill="currentColor"/>
      <text
        x="147.5" y="16" textAnchor="middle" textLength="58" lengthAdjust="spacingAndGlyphs"
        fontFamily={WORDMARK_FONT} fontSize="11" fontWeight="900" fill="var(--dsw-alias-label-primary-inverted, #fff)"
      >{WORDMARK_BADGE}</text>
    </svg>
  )
}
