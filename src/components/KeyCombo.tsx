import { css } from '@linaria/core'
import type { FC, ReactElement } from 'react'
// Icons served from public assets; use URL strings
const AddIcon = '/assets/icons/add.svg'
const ArrowRightIcon = '/assets/icons/arrow-right.svg'
const TouchIcon = '/assets/icons/pan-tool.svg'
import type { ResolvedActivity } from '../data/schema'
import { Icon } from './Icon'
import { Keypress } from './Keypress'

const keyComboClass = css`
  display: flex;
  align-items: center;
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
  opacity: 0.7;
  // color: #878d8f;
  // zoom: 1.5;
`

export const KeyCombo: FC<{ keypress: ResolvedActivity['keypress']; id: string }> = ({ keypress, id }) => {
  if (!Array.isArray(keypress)) {
    return <Keypress keys={keypress} />
  }

  const elements: ReactElement[] = []

  for (let i = 0; i < keypress.length; i++) {
    const key = keypress[i]

    if (key === 'after' || key === 'and') {
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
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px' }}>
          HOLD
        </span>
      )
    } else if (key === '2x') {
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px' }}>
          2x
        </span>
      )
    } else if (key === '3x') {
      elements.push(
        <span key={`${id}-${i}-${key}`} style={{ margin: '0 4px' }}>
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
      // It's a Key or Key[] - modifier is encoded in each key's suffix
      elements.push(<Keypress key={`${id}-${i}`} keys={key} />)
    }
  }

  return <div className={keyComboClass}>{elements}</div>
}
