// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  FISH_LOGO_PATH, FISH_LOGO_VIEWBOX, IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { ConversationContentProps } from '../contract/slots.ts'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationContentProps['t']

/**
 * Basename label for the workspace chip (the shared derivation);
 * separator-only paths echo the raw cwd.
 * @param cwd - workspace directory path (non-empty).
 * @returns chip label.
 */
export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/**
 * The workspace chip (folder + label + chevron), always interactive: before
 * the first message the workspace stays switchable — picking another one
 * moves the New Session flow to that workspace's blank session. Without a
 * label the chip renders its placeholder state: closed folder + the
 * "Choose workspace" call to action.
 * @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
 * @param props.menuOpen - menu expansion echo.
 * @param props.onClick - menu toggle.
 * @returns the chip button element.
 */
export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderCloseRegular className={css.folder} size={16} />
        : <IconFolderOpenRegular className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutlineRegular className={css.chevron} size={12} />
    </button>
  )
}

/** Hero chrome props. The workspace row rides the InputBar accessory hole, not here. */
export interface HeroShellProps {
  /** The owner's locale seat, passed down as a plain prop. */
  t: HeroTranslate
  /** Authorized renderer for the hero brand-mark slot. */
  renderSlot: ConversationContentProps['renderSlot']
  /** Overlay content after the stack (modals). */
  children?: ReactNode
}

/* Hover swim morph targets: the resting FISH_LOGO_PATH outline regenerated with the same
   point count, tilted -6 degrees and lifted (UP) or tilted +5 degrees and lowered (DOWN) about
   the glyph centre, so SMIL can interpolate `d` between them. */
const HERO_SWIM_UP_PATH =
  'M16.719 2.066L16.532 1.809L16.274 1.520L15.993 1.261L15.694 1.032L15.382 0.830L15.057 0.655L14.723 0.503L14.380 0.373L14.031 0.262L13.676 0.171L13.315 0.097L12.951 0.040L12.583 -0.002L12.212 -0.028L11.840 -0.039L11.467 -0.035L11.094 -0.017L10.709 0.016L10.262 0.080L9.813 0.176L9.379 0.304L8.960 0.461L8.558 0.648L8.175 0.864L7.814 1.108L7.475 1.379L7.161 1.677L6.874 2.002L6.618 2.351L6.394 2.725L6.206 3.120L6.056 3.535L5.947 3.966L5.882 4.411L5.861 4.866L5.887 5.330L5.963 5.795L6.092 6.246L6.270 6.670L6.494 7.062L6.755 7.417L7.047 7.735L7.361 8.015L7.692 8.260L8.036 8.475L8.388 8.663L8.748 8.827L9.112 8.971L9.481 9.098L9.851 9.209L10.222 9.308L10.593 9.395L10.962 9.473L11.318 9.541L11.647 9.604L11.959 9.670L12.260 9.740L12.550 9.817L12.824 9.900L13.082 9.988L13.320 10.082L13.537 10.181L13.730 10.283L13.898 10.388L14.040 10.493L14.157 10.597L14.251 10.699L14.326 10.800L14.386 10.905L14.434 11.018L14.472 11.149L14.498 11.310L14.507 11.490L14.500 11.664L14.475 11.829L14.435 11.989L14.379 12.144L14.307 12.295L14.218 12.443L14.113 12.586L13.990 12.724L13.851 12.857L13.693 12.983L13.519 13.100L13.328 13.208L13.121 13.304L12.898 13.388L12.661 13.458L12.410 13.512L12.131 13.550L11.879 13.572L11.613 13.585L11.348 13.587L11.086 13.579L10.830 13.562L10.581 13.534L10.341 13.496L10.112 13.449L9.896 13.394L9.695 13.330L9.510 13.260L9.344 13.185L9.197 13.105L9.070 13.024L8.963 12.942L8.876 12.862L8.806 12.784L8.708 12.645L8.592 12.504L8.459 12.379L8.310 12.273L8.149 12.187L7.978 12.123L7.800 12.082L7.619 12.064L7.436 12.070L7.256 12.100L7.081 12.153L6.915 12.229L6.760 12.326L6.619 12.442L6.495 12.575L6.389 12.724L6.303 12.885L6.239 13.056L6.197 13.234L6.180 13.415L6.186 13.598L6.216 13.778L6.269 13.952L6.345 14.119L6.441 14.274L6.628 14.531L6.886 14.820L7.167 15.079L7.466 15.308L7.778 15.510L8.103 15.685L8.437 15.837L8.780 15.967L9.129 16.078L9.484 16.169L9.845 16.243L10.209 16.300L10.577 16.342L10.948 16.368L11.320 16.379L11.693 16.375L12.066 16.357L12.451 16.324L12.898 16.260L13.347 16.164L13.781 16.036L14.200 15.879L14.602 15.692L14.985 15.476L15.346 15.232L15.685 14.961L15.999 14.663L16.286 14.338L16.542 13.989L16.766 13.615L16.954 13.220L17.104 12.805L17.213 12.374L17.278 11.929L17.299 11.474L17.273 11.010L17.197 10.545L17.068 10.094L16.890 9.670L16.666 9.278L16.405 8.923L16.113 8.605L15.799 8.325L15.468 8.080L15.124 7.865L14.772 7.677L14.412 7.513L14.048 7.369L13.679 7.242L13.309 7.131L12.938 7.032L12.567 6.945L12.198 6.867L11.842 6.799L11.513 6.736L11.201 6.670L10.900 6.600L10.610 6.523L10.336 6.440L10.078 6.352L9.840 6.258L9.623 6.159L9.430 6.057L9.262 5.952L9.120 5.847L9.003 5.743L8.909 5.641L8.834 5.540L8.774 5.435L8.726 5.322L8.688 5.191L8.662 5.030L8.653 4.850L8.660 4.676L8.685 4.511L8.725 4.351L8.781 4.196L8.853 4.045L8.942 3.897L9.047 3.754L9.170 3.616L9.309 3.483L9.467 3.357L9.641 3.240L9.832 3.132L10.039 3.036L10.262 2.952L10.499 2.882L10.750 2.828L11.029 2.790L11.281 2.768L11.547 2.755L11.812 2.753L12.074 2.761L12.330 2.778L12.579 2.806L12.819 2.844L13.048 2.891L13.264 2.946L13.465 3.010L13.650 3.080L13.816 3.155L13.963 3.235L14.090 3.316L14.197 3.398L14.284 3.478L14.354 3.556L14.452 3.695L14.568 3.836L14.701 3.961L14.850 4.067L15.011 4.153L15.182 4.217L15.360 4.258L15.541 4.276L15.724 4.270L15.904 4.240L16.079 4.187L16.245 4.111L16.400 4.014L16.541 3.898L16.665 3.765L16.771 3.616L16.857 3.455L16.921 3.284L16.963 3.106L16.980 2.925L16.974 2.742L16.944 2.562L16.891 2.388L16.815 2.221Z'
const HERO_SWIM_DOWN_PATH =
  'M17.789 3.759L17.654 3.471L17.456 3.137L17.230 2.830L16.981 2.548L16.712 2.291L16.427 2.056L16.128 1.843L15.817 1.650L15.495 1.475L15.163 1.318L14.824 1.176L14.477 1.051L14.123 0.940L13.765 0.844L13.401 0.762L13.035 0.694L12.666 0.641L12.281 0.600L11.830 0.577L11.371 0.586L10.920 0.628L10.479 0.703L10.049 0.810L9.632 0.948L9.230 1.119L8.846 1.320L8.481 1.553L8.138 1.817L7.819 2.111L7.528 2.435L7.268 2.787L7.042 3.166L6.853 3.568L6.704 3.993L6.597 4.435L6.534 4.896L6.519 5.367L6.560 5.834L6.654 6.285L6.799 6.712L6.987 7.111L7.213 7.477L7.468 7.812L7.746 8.117L8.043 8.393L8.353 8.645L8.675 8.875L9.005 9.086L9.342 9.280L9.685 9.460L10.030 9.628L10.378 9.784L10.725 9.931L11.061 10.066L11.372 10.190L11.666 10.314L11.948 10.441L12.217 10.572L12.471 10.705L12.708 10.841L12.924 10.979L13.117 11.117L13.287 11.255L13.432 11.389L13.551 11.519L13.646 11.644L13.720 11.762L13.774 11.876L13.813 11.990L13.838 12.111L13.850 12.246L13.845 12.409L13.820 12.588L13.779 12.757L13.724 12.915L13.653 13.064L13.569 13.205L13.469 13.340L13.354 13.467L13.224 13.588L13.077 13.701L12.915 13.804L12.736 13.898L12.543 13.980L12.335 14.049L12.113 14.104L11.879 14.144L11.632 14.167L11.376 14.172L11.095 14.157L10.843 14.130L10.579 14.091L10.318 14.043L10.063 13.986L9.815 13.919L9.576 13.844L9.347 13.762L9.132 13.672L8.930 13.576L8.745 13.476L8.577 13.372L8.428 13.266L8.299 13.160L8.190 13.056L8.100 12.955L8.030 12.860L7.977 12.770L7.907 12.615L7.820 12.454L7.713 12.306L7.587 12.174L7.446 12.059L7.290 11.963L7.123 11.889L6.948 11.837L6.768 11.808L6.586 11.803L6.404 11.822L6.226 11.864L6.056 11.930L5.895 12.017L5.748 12.124L5.615 12.249L5.500 12.391L5.404 12.547L5.330 12.713L5.278 12.888L5.249 13.069L5.244 13.251L5.263 13.433L5.306 13.610L5.371 13.781L5.506 14.069L5.704 14.403L5.930 14.710L6.179 14.992L6.448 15.249L6.733 15.484L7.032 15.697L7.343 15.890L7.665 16.065L7.997 16.222L8.336 16.364L8.683 16.489L9.037 16.600L9.395 16.696L9.759 16.778L10.125 16.846L10.494 16.899L10.879 16.940L11.330 16.963L11.789 16.954L12.240 16.912L12.681 16.837L13.111 16.730L13.528 16.592L13.930 16.421L14.314 16.220L14.679 15.987L15.022 15.723L15.341 15.429L15.632 15.105L15.892 14.753L16.118 14.374L16.307 13.972L16.456 13.547L16.563 13.105L16.626 12.644L16.641 12.173L16.600 11.706L16.506 11.255L16.361 10.828L16.173 10.429L15.947 10.063L15.692 9.728L15.414 9.423L15.117 9.147L14.807 8.895L14.485 8.665L14.155 8.454L13.818 8.260L13.475 8.080L13.130 7.912L12.782 7.756L12.435 7.609L12.099 7.474L11.788 7.350L11.494 7.226L11.212 7.099L10.943 6.968L10.689 6.835L10.452 6.699L10.236 6.561L10.043 6.423L9.873 6.285L9.728 6.151L9.609 6.021L9.514 5.896L9.440 5.778L9.386 5.664L9.347 5.550L9.322 5.429L9.310 5.294L9.315 5.131L9.340 4.952L9.381 4.783L9.436 4.625L9.507 4.476L9.591 4.335L9.691 4.200L9.806 4.073L9.936 3.952L10.083 3.839L10.245 3.736L10.424 3.642L10.617 3.560L10.825 3.491L11.047 3.436L11.281 3.396L11.528 3.373L11.784 3.368L12.065 3.383L12.317 3.410L12.581 3.449L12.842 3.497L13.097 3.554L13.345 3.621L13.584 3.696L13.813 3.778L14.028 3.868L14.230 3.964L14.415 4.064L14.583 4.168L14.732 4.274L14.861 4.380L14.970 4.484L15.060 4.585L15.130 4.680L15.183 4.770L15.253 4.925L15.340 5.086L15.447 5.234L15.573 5.366L15.714 5.481L15.870 5.577L16.037 5.651L16.212 5.703L16.392 5.732L16.574 5.737L16.756 5.718L16.934 5.676L17.104 5.610L17.265 5.523L17.412 5.416L17.545 5.291L17.660 5.149L17.756 4.993L17.830 4.827L17.882 4.652L17.911 4.471L17.916 4.289L17.897 4.107L17.854 3.930Z'

/**
 * The hero fish (34px wide), static at rest. Hovering swims the whale in
 * place: a gentle head-up sway (CSS, on the hitbox hover) while the body
 * itself morphs — SMIL interpolates `d` through the tail-up and tail-down
 * targets on the same 1.6s period, so the tail wags and the fin flutters in
 * real curve deformation. Decorative — hidden from the accessibility tree;
 * reduced motion keeps the static filled logo on hover (sampled at
 * mouseenter; a mid-hover preference change takes effect on the next enter).
 * @param props.hovering - driven by the hitbox parent's pointer state.
 * @returns the fish svg element.
 */
function HeroFish({ hovering }: { hovering: boolean }) {
  return (
    <svg
      className={css.fish}
      width={34}
      height={(34 * FISH_LOGO_VIEWBOX.height) / FISH_LOGO_VIEWBOX.width}
      viewBox={`0 0 ${FISH_LOGO_VIEWBOX.width} ${FISH_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={FISH_LOGO_PATH} fill="currentColor">
        {hovering && (
          <animate
            attributeName="d"
            values={`${FISH_LOGO_PATH};${HERO_SWIM_UP_PATH};${FISH_LOGO_PATH};${HERO_SWIM_DOWN_PATH};${FISH_LOGO_PATH}`}
            keyTimes="0;0.35;0.55;0.75;1"
            calcMode="spline"
            keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </svg>
  )
}

/**
 * Render the hero chrome (headline only; no composer, no workspace row).
 * @param props - see {@link HeroShellProps}.
 * @returns the centered hero element tree.
 */
export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  const [hovering, setHovering] = useState(false)
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: fish 34×25 leading the headline, gap 10. */}
          <span
            className={css.fishHitbox}
            onPointerEnter={(event) => {
              if (event.pointerType !== 'touch'
                && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
                setHovering(true)
              }
            }}
            onPointerLeave={() => { setHovering(false) }}
          >
            {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.fish }, {
              fallback: <HeroFish hovering={hovering} />,
            })}
          </span>
          <span className={css.titleGroup}>
            {/* Own element: keeps the headline text addressable apart from the badge. */}
            <span>{t('hero.headline')}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
