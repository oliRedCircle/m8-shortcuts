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

export type Key = KeyDown | `${KeyDown}-hold`



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
      
      /* Pattern: FIRST [1,1,1,1,1,0,0,0] - 5 beats with fade */
      &.animated-first {
        animation: key-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: RELEASE_FIRST [1,1,1,1,0,0,0,0] - 4 beats */
      &.animated-release-first {
        animation: key-release-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: NOT_FIRST [0,0,1,1,1,0,0,0] - starts at beat 3 */
      &.animated-not-first {
        animation: key-not-first ${animation.durationCSS} linear infinite;
      }
      
      /* Pattern: ONE_X [1,0,0,0,0,0,0,0] - single short press */
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
      /* Immediate ON - Stay lit for 5 beats (0-62.5%) */
      0%, 57% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      62%, 62.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      62.5%, 100% {
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
      /* Immediate ON - Stay lit for 3 beats (25-62.5%) */
      25%, 57% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      62%, 62.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      62.5%, 100% {
        opacity: 0;
        filter: brightness(1);
      }
    }
    
    @keyframes key-1x {
      /* Immediate ON */
      0%, 5% {
        opacity: 1;
        filter: brightness(1.5);
      }
      /* Fade out */
      10%, 12.5% {
        opacity: 0;
        filter: brightness(1);
      }
      /* Stay off */
      12.5%, 100% {
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

const has = (which: Key, keys: Key[] | Key) => {
  if (keys === which) {
    return true;
  }

  if (Array.isArray(keys)) {
    return keys.some(x => x.startsWith(which))
  }
  return keys.startsWith(which)
}

const isDirectionKey = (which: Key): boolean => {
  const baseKey = which.replace('-hold', '')
  return ['up', 'down', 'left', 'right'].includes(baseKey)
}

// Determine animation class based on key position and modifiers
const getAnimationClass = (which: Key, keys: Key[] | Key, modifier?: '1x' | '2x' | '3x'): string => {
  const keyArray = Array.isArray(keys) ? keys : [keys]

  // Find the index of this key in the array
  const keyIndex = keyArray.findIndex(k => k.startsWith(which))

  if (keyIndex === -1) return ''

  const key = keyArray[keyIndex]
  const isFirst = keyIndex === 0

  // Check if this specific key is a hold key
  if (key.endsWith('-hold')) {
    return 'animated-hold'
  }

  // Direction keys use pulses pattern
  if (isDirectionKey(key)) {
    return 'animated-pulses'
  }

  // Apply modifier animations
  if (modifier === '1x') {
    return 'animated-1x'
  }
  if (modifier === '2x') {
    return 'animated-2x'
  }
  if (modifier === '3x') {
    return 'animated-3x'
  }

  // First key gets FIRST animation
  if (isFirst) {
    return 'animated-first'
  }

  // Subsequent keys use NOT_FIRST
  return 'animated-not-first'
}

export const Keypress: FC<{
  keys: Key[] | Key
  modifier?: '1x' | '2x' | '3x'
}> = ({ keys, modifier }) => {
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

        {has('left', keys) && <Icon icon={PressSprite} className={cx("left", "action", getAnimationClass('left', keys, modifier))} />}
        {has('right', keys) && <Icon icon={PressSprite} className={cx("right", "action", getAnimationClass('right', keys, modifier))} />}
        {has('up', keys) && <Icon icon={PressSprite} className={cx("up", "action", getAnimationClass('up', keys, modifier))} />}
        {has('down', keys) && <Icon icon={PressSprite} className={cx("down", "action", getAnimationClass('down', keys, modifier))} />}
        {has('edit', keys) && <Icon icon={PressSprite} className={cx("edit", "action", getAnimationClass('edit', keys, modifier))} />}
        {has('opt', keys) && <Icon icon={PressSprite} className={cx("opt", "action", getAnimationClass('opt', keys, modifier))} />}
        {has('shift', keys) && <Icon icon={PressSprite} className={cx("shift", "action", getAnimationClass('shift', keys, modifier))} />}
        {has('play', keys) && <Icon icon={PressSprite} className={cx("play", "action", getAnimationClass('play', keys, modifier))} />}
      </div>
      <Timeline keys={keys} modifier={modifier} />
    </div>
  )
}
