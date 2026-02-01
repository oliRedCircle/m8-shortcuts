import { css, cx } from '@linaria/core'
import { type FC, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fragments } from '../app/style/fragments'
import { style } from '../app/style/style'
import { useAppParams, useAppQuery } from './useAppParams'
import { useDataset } from '../hooks/useDataset'
import type { Category, ScreenData } from '../data/schema'

const entryClass = css`
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  opacity: 0.65;
  transition: ${fragments.transition.regular('opacity')}, ${fragments.transition.regular('background-color')};
  z-index: -1;
  &:hover {
    opacity: 0.85;
    background-color: ${style.themeColors.background.defaultHover};
  }

  > h3 {
    margin: 0;
  }

  > img {
    max-width: 100%;
  }

  &.active {
    cursor: unset;
    opacity: 1.0;
    background-color: ${style.themeColors.background.defaultHover};
    > h3 { 
      color: ${style.themeColors.text.important};
    }
  }
`

const ScreenEntry: FC<{ screen: ScreenData }> = ({ screen }) => {
  const params = useAppParams()
  const { key, levels, mode: modeQuery } = useAppQuery()
  const navigate = useNavigate()
  const qs = useMemo(() => {
    const parts: string[] = []
    if (key) parts.push(`key=${encodeURIComponent(key)}`)
    if (levels && levels.size > 0) parts.push(`levels=${[...levels].sort().join('')}`)
    if (modeQuery) parts.push(`mode=${modeQuery}`)
    return parts.length ? `?${parts.join('&')}` : ''
  }, [key, levels, modeQuery])
  return (
    <div
      className={cx(entryClass, 'entry', params.screen === screen.id && 'active')}
      onClick={(evt) => {
        evt.stopPropagation()
        navigate(`/${screen.id}/${params.activity ?? ''}/${params.mode ?? 'full'}${qs}`)
      }}
    >
      <h3>{screen.name}</h3>
      {/* <img src={screen.img} /> */}
    </div>
  )
}

const categoryClass = css`  
  transition: ${fragments.transition.regular('height')};
  scrollbar-gutter: stable;
  isolation: isolate;
  > h2 {
    cursor: pointer;
    background-color: ${style.themeColors.background.default};
    position: sticky;
    z-index: 3;
    display: flex;
    align-items: center;
    top: 0px;
    padding: 24px 16px 4px 4px;
    margin: 0;
    border-bottom: 2px solid ${style.themeColors.line.default};
  }
`

const ScreenCategory: FC<{ category: Category; screens: ScreenData[] }> = ({ category, screens }) => {
  return (
    <div className={cx(categoryClass, 'category', 'open')}>
      <h2>{category.name}</h2>
      {screens.map((x) => (
        <ScreenEntry key={`${category.id}-${x.id}`} screen={x} />
      ))}
    </div>
  )
}

const selectionClass = css`
  position: relative;
  background: ${style.themeColors.background.default};

  > .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 100%;
    width: max-content;
    max-width: 550px;
    max-height: 100%;
    overflow-y: scroll;

    > h3 {
      margin: 0 0 15px 0;
    }
  }

  > .sidebar-title {
    display: none;
  }

  &.full {
    > .content {
      z-index: 1;
      position: relative;
      background: ${style.themeColors.background.default};
      left: 0;
      opacity: 1;
      transform: none;
      pointer-events: all;
    }
  }

  /* Collapse behavior in full mode on narrow screens (<900px) */
  @media (max-width: 900px) {
    & {
      width: 30px;
      max-width: 30px;
      flex: 0 0 30px;
      padding-right: 0px;
      border-left: 1px solid ${style.themeColors.line.default};

      > .sidebar-title {
        display: block;
        transform: translateX(5px) rotate(90deg);
        padding-left: 30px;
        z-index: 2;
      }

      /* Override the full-mode open state under 900px */
      &.full > .content {
        z-index: 1;
        position: absolute;
        background: ${style.themeColors.background.default};
        left: 10px;
        opacity: 0;
        transform: translateX(-100%);
        transition: 0.25s ease transform, 0.25s 0.1s ease opacity;
        pointer-events: none;
        padding-right: 30px;
        padding-left: 10px;
        border-right: 1px solid ${style.themeColors.line.default};
        min-height: 100vh;
        max-width: calc(90vw - 125px);

        > .sticky-fill {
          z-index: 2;
          min-height: 25px;
          width: 100%;
          position: sticky;
          top: 0;
          background-color: ${style.themeColors.background.default};
        }
      }

      &:hover, &.full>.content:hover {
        overflow-x: visible;
        &.full > .content {
          opacity: 1;
          transform: translateX(0);
          pointer-events: all;
        }
      }
    }
  }

  &.minified {
    max-width: 30px;
    padding-right: 0px;
    border-left: 1px solid ${style.themeColors.line.default};

    > .sidebar-title {
      display: block;
      transform: translateX(5px) rotate(90deg);
      padding-left: 30px;
      z-index: 2;
    }

    > .content {
      z-index: 1;
      position: absolute;
      background: ${style.themeColors.background.default};
      left: 10px;
      opacity: 0;
      transform: translateX(-100%);
      transition: 0.25s ease transform, 0.25s 0.1s ease opacity;
      pointer-events: none;
      padding-right: 30px;
      padding-left: 10px;
      border-right: 1px solid ${style.themeColors.line.default};
      min-height: 100vh;
      max-width: calc(90vw - 125px);

      > .sticky-fill {
        z-index: 2;
        min-height: 25px;
        width: 100%;
        position: sticky;
        top: 0;
        background-color: ${style.themeColors.background.default};
      }
    }

    &:hover, &>.content:hover {
      overflow-x: visible;
      > .content {
        opacity: 1;
        transform: translateX(0);
        pointer-events: all;
      }
    }
  }
`

export const ScreenSelection: FC = () => {
  const params = useAppParams()
  const modeClass = params.mode === 'min' ? 'minified' : 'full'
  const { data, helper } = useDataset()
  const grouped = useMemo(() => {
    if (!data || !helper) return [] as { category: Category; screens: ScreenData[] }[]
    return helper.screenCategories.map((cat) => ({
      category: cat,
      screens: data.screens.filter((s) => s.categoryIds.includes(cat.id) && s.activityIds.length > 0),
    }))
  }, [data, helper])

  return (
    <div className={cx(selectionClass, modeClass)}>
      <div className="content">
        <div className="sticky-fill" />
        {grouped.map((g) => (
          <ScreenCategory key={g.category.id} category={g.category} screens={g.screens} />
        ))}
      </div>
      <h3 className="sidebar-title">Screens</h3>
    </div>
  )
}
