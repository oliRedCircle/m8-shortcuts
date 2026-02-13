import { css, cx } from '@linaria/core'
import type { FC } from 'react'
// Sprites served from public assets
const ButtonSprite = '/assets/sprites/button.svg'
const PressSprite = '/assets/sprites/button-press.svg'
import { animation } from '../app/style/animation'
import { style } from '../app/style/style'
import { Icon } from './Icon'
import { Timeline } from './Timeline'


type KeyDown = 'up' | 'down' | 'left' | 'right' | 'edit' | 'opt' | 'shift' | 'play'

type KeyModifier = 'hold' | 'first' | 'release-first' | 'not-first' | 'pulses' | '1x' | '2x' | '3x' | '1x-not-first' | '2x-not-first' | '3x-not-first'

export type Key = KeyDown | `${KeyDown}-${KeyModifier}`



const keypressClass = css`
  display: inline-flex;
  flex-direction: column;
  position: relative;
  
  width: 28px;
  max-width: 28px;
  min-width: 28px;

  margin: 0 4px;

  zoom: 1.5;

  > .keypress-visual {
    width: 28px;
    height: 24px;
    position: relative;

    > .icon {
      position: absolute;
      width: 6px;
      height: 6px;

      color: #878d8f; 

      &.press {
        animation: 1.0s linear infinite both rotate-opacity;
        @keyframes rotate-opacity {
          49.999% { opacity: 1.0; }
          50% { opacity: 0.65; }
          74.999% { opacity: 0.65; }
          75% { opacity: 1.0; }
        }
      }
      
      /* Synchronized animations with timeline playhead */
      /* Pattern: HOLD - active all the time, no fade */
      &.animated-hold {
        animation: key-hold ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: PULSES [1,0,1,0,1,0,1,0] - direction keys */
      &.animated-pulses {
        animation: key-pulses ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: FIRST [1,1,1,1,1,1,0,0] - 6 beats with fade */
      &.animated-first {
        animation: key-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: RELEASE_FIRST [1,1,1,1,0,0,0,0] - 4 beats */
      &.animated-release-first {
        animation: key-release-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: NOT_FIRST [0,0,1,1,1,1,0,0] - starts at beat 3 */
      &.animated-not-first {
        animation: key-not-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: ONE_X [1,1,0,0,0,0,0,0] - single held press */
      &.animated-1x {
        animation: key-1x ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: TWO_X [1,0,1,0,0,0,0,0] - two short presses */
      &.animated-2x {
        animation: key-2x ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: THREE_X [1,0,1,0,1,0,0,0] - three short presses */
      &.animated-3x {
        animation: key-3x ${animation.durationCSS} linear infinite;
      }

      /* Pattern: ONE_X_NOT_FIRST [0,0,1,1,0,0,0,0] - single held tap after delay */
      &.animated-1x-not-first {
        animation: key-1x-not-first ${animation.durationCSS} linear infinite;
      }

      /* Pattern: TWO_X_NOT_FIRST [0,0,1,0,1,0,0,0] - double tap after delay */
      &.animated-2x-not-first {
        animation: key-2x-not-first ${animation.durationCSS} linear infinite;
      }

      /* Pattern: THREE_X_NOT_FIRST [0,0,1,0,1,0,1,0] - triple tap after delay */
      &.animated-3x-not-first {
        animation: key-3x-not-first ${animation.durationCSS} linear infinite;
      }
    }
    
    /* Animation keyframes - each cell is 12.5% (100% / 8 beats) */
    @keyframes key-hold {
      0%, 100% {
        opacity: 1;
        filter: brightness(1.5);
      }
    }
    
    @keyframes key-pulses {
      /* Beat 1: ON */
      0%, 12.4% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Beat 2: OFF */
      12.5%, 24.9% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Beat 3: ON */
      25%, 37.4% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Beat 4: OFF */
      37.5%, 49.9% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Beat 5: ON */
      50%, 62.4% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Beat 6: OFF */
      62.5%, 74.9% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Beat 7: ON */
      75%, 87.4% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Beat 8: OFF */
      87.5%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-first {
      /* Immediate ON - Stay lit for 6 beats (0-75%) */
      0%, 70% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      74%, 75% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      75%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-release-first {
      /* Immediate ON - Stay lit for 4 beats (0-50%) */
      0%, 45% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      49%, 50% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      50%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-not-first {
      /* Off for 2 beats */
      0%, 24.9% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Immediate ON - Stay lit for 4 beats (25-75%) */
      25%, 70% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      74%, 75% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      75%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-1x {
      /* Immediate ON - Stay lit for 2 beats (0-25%) */
      0%, 20% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      24%, 25% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      25%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-2x {
      /* First pulse - immediate ON */
      0%, 5% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      10%, 12.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Second pulse - immediate ON */
      25%, 30% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      35%, 37.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      37.5%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-3x {
      /* First pulse - immediate ON */
      0%, 5% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      10%, 12.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Second pulse - immediate ON */
      25%, 30% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      35%, 37.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Third pulse - immediate ON */
      50%, 55% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      60%, 62.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      62.5%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }

    /* [0,0,1,1,0,0,0,0] - held tap at beats 3-4 */
    @keyframes key-1x-not-first {
      0%, 24.9% {
        opacity: 0;
        filter: brightness(1);
      }
      /* ON for 2 beats (25-50%) */
      25%, 45% {
        opacity: 1;
        filter: brightness(1.5);
      }
      49%, 50% {
        opacity: 0;
        filter: brightness(1);
      }
      50%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }

    /* [0,0,1,0,1,0,0,0] - double tap at beats 3 and 5 */
    @keyframes key-2x-not-first {
      0%, 24.9% {
        opacity: 0;
        filter: brightness(1);
      }
      25%, 30% {
        opacity: 1;
        filter: brightness(1.5);
      }
      35%, 37.5% {
        opacity: 0;
        filter: brightness(1);
      }
      50%, 55% {
        opacity: 1;
        filter: brightness(1.5);
      }
      60%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }

    /* [0,0,1,0,1,0,1,0] - triple tap at beats 3, 5 and 7 */
    @keyframes key-3x-not-first {
      0%, 24.9% {
        opacity: 0;
        filter: brightness(1);
      }
      25%, 30% {
        opacity: 1;
        filter: brightness(1.5);
      }
      35%, 37.5% {
        opacity: 0;
        filter: brightness(1);
      }
      50%, 55% {
        opacity: 1;
        filter: brightness(1.5);
      }
      60%, 62.5% {
        opacity: 0;
        filter: brightness(1);
      }
      75%, 80% {
        opacity: 1;
        filter: brightness(1.5);
      }
      85%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }

    > .opt {
      left: 16px;
      top: 0;
      &.action { color: ${style.colors.teal.primary}; }
    }

    > .edit {
      left: 22px;
      top: 0;
      &.action { color: ${style.colors.ochre.primary}; }
    }

    > .up {
      left: 6px;
      top: 3px;
    }

    > .left {
      left: 0;
      top: 9px;
    }

    > .down {
      left: 6px;
      top: 9px;
    }

    > .right {
      left: 12px;
      top: 9px;
    }

    > .shift {
      left: 6px;
      top: 18px;
      &.action { color: ${style.colors.raspberry[500]}; }
    }

    > .play {
      left: 12px;
      top: 18px;
      &.action { color: ${style.colors.lime.primary}; }
    }
  }
`

const BASE_KEYS = ['up', 'down', 'left', 'right', 'edit', 'opt', 'shift', 'play'] as const

/** Extract the base key name (without modifier suffix) */
export const baseKey = (key: Key): KeyDown => {
  for (const k of BASE_KEYS) {
    if (key === k || key.startsWith(`${k}-`)) return k
  }
  return key as KeyDown
}

/** Extract the modifier suffix from a key, or undefined if none */
export const keyModifier = (key: Key): KeyModifier | undefined => {
  const base = baseKey(key)
  if (key === base) return undefined
  return key.slice(base.length + 1) as KeyModifier
}

const has = (which: KeyDown, keys: Key[] | Key) => {
  if (Array.isArray(keys)) {
    return keys.some(x => baseKey(x) === which)
  }
  return baseKey(keys) === which
}

const isDirectionKey = (which: KeyDown): boolean => {
  return ['up', 'down', 'left', 'right'].includes(which)
}

const MODIFIER_CLASS_MAP: Record<KeyModifier, string> = {
  'hold': 'animated-hold',
  'first': 'animated-first',
  'release-first': 'animated-release-first',
  'not-first': 'animated-not-first',
  'pulses': 'animated-pulses',
  '1x': 'animated-1x',
  '2x': 'animated-2x',
  '3x': 'animated-3x',
  '1x-not-first': 'animated-1x-not-first',
  '2x-not-first': 'animated-2x-not-first',
  '3x-not-first': 'animated-3x-not-first',
}

/** Map modifier to CSS animation class. Falls back to defaults based on key type and position. */
const getAnimationClass = (which: KeyDown, keys: Key[] | Key): string => {
  const keyArray = Array.isArray(keys) ? keys : [keys]
  const idx = keyArray.findIndex(k => baseKey(k) === which)
  if (idx === -1) return ''

  const mod = keyModifier(keyArray[idx])

  // Explicit modifier → direct mapping
  if (mod) return MODIFIER_CLASS_MAP[mod] ?? ''

  // Default: first position → direction=pulses, other=1x; non-first position → not-first
  if (idx === 0) {
    return isDirectionKey(which) ? 'animated-pulses' : 'animated-1x'
  }
  return 'animated-not-first'
}

export const Keypress: FC<{
  keys: Key[] | Key
}> = ({ keys }) => {
  return (
    <div className={cx(keypressClass, 'keypress')}>
      <div className="keypress-visual">
        <Icon icon={ButtonSprite} className="left" />
        <Icon icon={ButtonSprite} className="right" />
        <Icon icon={ButtonSprite} className="up" />
        <Icon icon={ButtonSprite} className="down" />
        <Icon icon={ButtonSprite} className="edit" />
        <Icon icon={ButtonSprite} className="opt" />
        <Icon icon={ButtonSprite} className="shift" />
        <Icon icon={ButtonSprite} className="play" />

        {has('left', keys) && <Icon icon={PressSprite} className={cx("left", "action", getAnimationClass('left', keys))} />}
        {has('right', keys) && <Icon icon={PressSprite} className={cx("right", "action", getAnimationClass('right', keys))} />}
        {has('up', keys) && <Icon icon={PressSprite} className={cx("up", "action", getAnimationClass('up', keys))} />}
        {has('down', keys) && <Icon icon={PressSprite} className={cx("down", "action", getAnimationClass('down', keys))} />}
        {has('edit', keys) && <Icon icon={PressSprite} className={cx("edit", "action", getAnimationClass('edit', keys))} />}
        {has('opt', keys) && <Icon icon={PressSprite} className={cx("opt", "action", getAnimationClass('opt', keys))} />}
        {has('shift', keys) && <Icon icon={PressSprite} className={cx("shift", "action", getAnimationClass('shift', keys))} />}
        {has('play', keys) && <Icon icon={PressSprite} className={cx("play", "action", getAnimationClass('play', keys))} />}
      </div>
      <Timeline keys={keys} />
    </div>
  )
}
