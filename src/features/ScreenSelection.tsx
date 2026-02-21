import { css, cx } from '@linaria/core'
import { type FC, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fragments } from '../app/style/fragments'
import { columnCategoryClass, columnClass } from '../app/style/selectionColumn'
import { style } from '../app/style/style'
import type { Category, ScreenData } from '../data/schema'
import { useDataset } from '../hooks/useDataset'
import { useAppParams, useAppQuery } from './useAppParams'

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

const ScreenCategory: FC<{ category: Category; screens: ScreenData[] }> = ({ category, screens }) => {
  return (
    <div className={cx(columnCategoryClass, 'category', 'open')}>
      <h2>{category.name}</h2>
      {screens.map((x) => (
        <ScreenEntry key={`${category.id}-${x.id}`} screen={x} />
      ))}
    </div>
  )
}

export const ScreenSelection: FC = () => {
  const { data, helper } = useDataset()
  const grouped = useMemo(() => {
    if (!data || !helper) return [] as { category: Category; screens: ScreenData[] }[]
    return helper.screenCategories.map((cat) => ({
      category: cat,
      screens: data.screens.filter((s) => s.categoryIds.includes(cat.id) && s.activities.length > 0),
    }))
  }, [data, helper])

  return (
    <div className={columnClass}>
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
