import { css } from '@linaria/core'
import type { FC } from 'react'
import { animation } from '../app/style/animation'
import { style } from '../app/style/style'
import { baseKey, keyModifier, type Key } from './Keypress'

interface TimelineProps {
    keys: Key[] | Key
    beatWidth?: number
}

const timelineClass = css`
  width: 24px;
  margin-top: 2px;
  position: relative;
  border: outset thin rgba(255, 255, 255, 0.2);

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: white;
    opacity: 0.9;
    z-index: 10;
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.8);
    animation: playhead-sweep ${animation.durationCSS} linear infinite;
  }

  @keyframes playhead-sweep {
    0% {
      left: 0;
    }
    100% {
      left: 100%;
    }
  }
`

const CELL_SIZE = 3 // 3px grid cell

// Map keys to their colors based on the Keypress component
const getKeyColor = (key: Key): string => {
    const base = baseKey(key)

    switch (base) {
        case 'opt':
            return style.colors.teal.primary
        case 'edit':
            return style.colors.ochre.primary
        case 'shift':
            return style.colors.raspberry[500]
        case 'play':
            return style.colors.lime.primary
        case 'up':
        case 'down':
        case 'left':
        case 'right':
            return '#878d8f'
        default:
            return '#878d8f'
    }
}

const isDirectionKey = (key: Key): boolean => {
    const base = baseKey(key)
    return ['up', 'down', 'left', 'right'].includes(base)
}

const getArrowPath = (key: Key, x: number, y: number): string => {
    const base = baseKey(key)
    const size = 1.5
    const centerY = y + 1.5 // Center vertically in 3px height
    const arrowX = x + 1

    switch (base) {
        case 'up':
            return `M ${arrowX},${centerY + size} L ${arrowX + size},${centerY} L ${arrowX + size * 2},${centerY + size} Z`
        case 'down':
            return `M ${arrowX},${centerY - size} L ${arrowX + size},${centerY} L ${arrowX + size * 2},${centerY - size} Z`
        case 'left':
            return `M ${arrowX + size},${centerY - size} L ${arrowX},${centerY} L ${arrowX + size},${centerY + size} Z`
        case 'right':
            return `M ${arrowX},${centerY - size} L ${arrowX + size},${centerY} L ${arrowX},${centerY + size} Z`
        default:
            return ''
    }
}

// Rule-based patterns: 1 = filled, 0 = empty
// Each pattern represents 8 cells (24px / 3px per cell)
const PATTERNS = {
    'hold': [1, 1, 1, 1, 1, 1, 1, 1],
    'first': [1, 1, 1, 1, 1, 1, 0, 0],
    'release-first': [1, 1, 1, 1, 0, 0, 0, 0],
    'not-first': [0, 0, 1, 1, 1, 1, 0, 0],
    'pulses': [1, 0, 1, 0, 1, 0, 1, 0],
    '1x': [1, 1, 0, 0, 0, 0, 0, 0],
    '2x': [1, 0, 1, 0, 0, 0, 0, 0],
    '3x': [1, 0, 1, 0, 1, 0, 0, 0],
    '1x-not-first': [0, 0, 1, 1, 0, 0, 0, 0],
    '2x-not-first': [0, 0, 1, 0, 1, 0, 0, 0],
    '3x-not-first': [0, 0, 1, 0, 1, 0, 1, 0],
} as const

interface Rectangle {
    key: Key
    x: number
    y: number
    width: number
    color: string
    isDirection: boolean
}

const createRectangle = (key: Key, x: number, y: number, width: number): Rectangle => ({
    key,
    x,
    y,
    width,
    color: getKeyColor(key),
    isDirection: isDirectionKey(key),
})

// Determine which pattern to use for a key based on its explicit modifier and position
const getPattern = (key: Key, isFirst: boolean): readonly number[] => {
    const mod = keyModifier(key)

    // Explicit modifier → direct lookup
    if (mod && mod in PATTERNS) {
        return PATTERNS[mod as keyof typeof PATTERNS]
    }

    // Default: first position → direction=pulses, other=1x; non-first position → not-first
    if (isFirst) {
        return isDirectionKey(key) ? PATTERNS.pulses : PATTERNS['1x']
    }
    return PATTERNS['not-first']
}

// Convert a pattern array into rectangles
const patternToRectangles = (
    pattern: readonly number[],
    key: Key,
    yPosition: number
): Rectangle[] => {
    const rectangles: Rectangle[] = []
    let currentStart: number | null = null

    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === 1) {
            // Start of a filled region
            if (currentStart === null) {
                currentStart = i
            }
        } else {
            // End of a filled region
            if (currentStart !== null) {
                const width = (i - currentStart) * CELL_SIZE
                rectangles.push(
                    createRectangle(key, currentStart * CELL_SIZE, yPosition, width)
                )
                currentStart = null
            }
        }
    }

    // Handle case where pattern ends with 1s
    if (currentStart !== null) {
        const width = (pattern.length - currentStart) * CELL_SIZE
        rectangles.push(
            createRectangle(key, currentStart * CELL_SIZE, yPosition, width)
        )
    }

    return rectangles
}

export const Timeline: FC<TimelineProps> = ({ keys, beatWidth = 24 }) => {
    const keyArray = Array.isArray(keys) ? keys : [keys]
    const rectangles: Rectangle[] = []

    // Stack keys from bottom to top (reverse order for y-positioning)
    for (let i = 0; i < keyArray.length; i++) {
        const key = keyArray[i]
        const yPosition = (keyArray.length - 1 - i) * CELL_SIZE

        // Get the pattern for this key
        const pattern = getPattern(key, i === 0)

        // Convert pattern to rectangles and add to the list
        const keyRectangles = patternToRectangles(pattern, key, yPosition)
        rectangles.push(...keyRectangles)
    }

    const totalHeight = Math.max(keyArray.length * CELL_SIZE, CELL_SIZE)

    return (
        <div className={timelineClass}>
            <svg width={beatWidth} height={totalHeight} style={{ display: 'block' }}>
                {rectangles.map((rect, idx) => (
                    <g key={`${rect.key}-${idx}`}>
                        <rect
                            x={rect.x}
                            y={rect.y}
                            width={rect.width}
                            height={CELL_SIZE}
                            fill={rect.color}
                            opacity={0.8}
                        />
                        {rect.isDirection && (
                            <path
                                d={getArrowPath(rect.key, rect.x, rect.y)}
                                fill="white"
                                opacity={0.9}
                            />
                        )}
                    </g>
                ))}
            </svg>
            <div className="playhead" />
        </div>
    )
}
