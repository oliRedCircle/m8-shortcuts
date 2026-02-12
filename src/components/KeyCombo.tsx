import { css } from '@linaria/core'
import type { FC, ReactElement } from 'react'
// Icons served from public assets; use URL strings
const AddIcon = '/assets/icons/add.svg'
const ArrowRightIcon = '/assets/icons/arrow-right.svg'
const TouchIcon = '/assets/icons/pan-tool.svg'
import type { ActivityData } from '../data/schema'
import { Icon } from './Icon'
import { Keypress } from './Keypress'

const keyComboClass = css`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0;
`

const connectorClass = css`
  display: flex;
  align-items: center;
  height: 24px;
  margin: 0 4px;
  zoom: 1.5;
  position: relative;

  &.with-timeline {
    padding-bottom: 8px;
  }

  > .connector-line {
    position: absolute;
    bottom: 2px;
    left: 0;
    right: 0;
    height: 2px;
    background: #878d8f;
    opacity: 0.5;
  }
`

const orSeparatorClass = css`
  margin: 0 8px;
  color: #878d8f;
  zoom: 1.5;
`

export const KeyCombo: FC<{ keypress: ActivityData['keypress']; id: string }> = ({ keypress, id }) => {
  if (!Array.isArray(keypress)) {
    return <Keypress keys={keypress} />
  }

  const elements: ReactElement[] = []
  let modifier: '1x' | '2x' | '3x' | undefined

  for (let i = 0; i < keypress.length; i++) {
    const key = keypress[i]

    if (key === 'after' || key === 'and') {
      // Add connector with timeline connection line
      const icon = key === 'after' ? ArrowRightIcon : AddIcon
      elements.push(
        <div key={`${id}-${i}-${key}`} className={`${connectorClass}`}>
          <Icon icon={icon} />
        </div>
      )
    } else if (key === 'or') {
      elements.push(
        <span key={`${id}-${i}-${key}`} className={orSeparatorClass}>
          |
        </span>
      )
    } else if (key === 'hold') {
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5 }}>
          HOLD
        </span>
      )
    } else if (key === '1x') {
      modifier = '1x'
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5, fontSize: '0.8em' }}>
          1x
        </span>
      )
    } else if (key === '2x') {
      modifier = '2x'
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5, fontSize: '0.8em' }}>
          2x
        </span>
      )
    } else if (key === '3x') {
      modifier = '3x'
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5, fontSize: '0.8em' }}>
          3x
        </span>
      )
    } else if (key === 'touch') {
      elements.push(
        <div key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5 }}>
          <Icon icon={TouchIcon} />
        </div>
      )
    } else if (key === 'midi') {
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px', zoom: 1.5 }}>
          MIDI
        </span>
      )
    } else {
      // It's a Key or Key[] - pass modifier if we have one
      elements.push(<Keypress key={`${id}-${i}`} keys={key} modifier={modifier} />)
      // Reset modifier after use
      modifier = undefined
    }
  }

  return <div className={keyComboClass}>{elements}</div>
}
