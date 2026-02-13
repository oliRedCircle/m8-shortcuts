import { css, cx } from '@linaria/core'
import { type FC, useMemo } from 'react'
import type { Key } from '../components/Keypress'
import { useNavigate } from 'react-router-dom'
// Fallback asset served from public (unused, kept for future):
const FALLBACK_IMAGE = '/assets/activity/no-screen-placeholder.png'
import { fragments } from '../app/style/fragments'
import { style } from '../app/style/style'
import { KeyCombo } from '../components/KeyCombo'
import { useAppParams, useAppQuery } from './useAppParams'
import { useDataset } from '../hooks/useDataset'
import type { ActivityData, Category, ScreenData } from '../data/schema'

const entryClass = css`
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  opacity: 0.85;
  transition: ${fragments.transition.regular('opacity')}, ${fragments.transition.regular('background-color')};
  z-index: 0;
  /* shared highlight color var, overridden by keycolor-* classes */
  --keycolor: ${style.themeColors.text.important};
  &:hover {
    opacity: 0.85;
    background-color: ${style.themeColors.background.defaultHover};
  }

  @media (max-width: 900px) {
    border-bottom: 1px solid ${style.themeColors.line.default};
  }

  > h3 {
    margin: 0;
    display: flex;
    align-items: center;

    @media (max-width: 900px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    > .title {
      flex: 1;
    }

    > .combo {
      display: flex;
      align-items: center;
      gap: 4px;
    }
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

  /* When any keycolor-* class is present, apply highlight utility */
  &[class*="keycolor-"] {
    box-shadow: inset 3px 0 var(--keycolor);
    border-left: 2px solid var(--keycolor);
    background-image: linear-gradient(to right, ${style.themeColors.background.defaultHover} 0%, transparent 30%);
  }

  /* per-key color classes, used via CSS var to avoid duplication */
  &.keycolor-opt { --keycolor: ${style.colors.teal.primary}; }
  &.keycolor-edit { --keycolor: ${style.colors.ochre.primary}; }
  &.keycolor-shift { --keycolor: ${style.colors.raspberry[500]}; }
  &.keycolor-play { --keycolor: ${style.colors.lime.primary}; }
`

const badgeClass = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  // padding: 0 6px;
  margin-right: 6px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1;
  border: 1px solid ${style.themeColors.line.default};
  color: ${style.themeColors.text.default};
  background-color: ${style.themeColors.background.default};
  opacity: 0.85;

  &.lvl-1 { }
  &.lvl-2 { }
  &.lvl-3 { }
`

const ActivityEntry: FC<{ activity: ActivityData; screen: ScreenData; highlightKey?: string; levels?: Set<number>; routedActivityId?: string; modeQuery?: 'min' | 'full' }> = ({ activity, screen, highlightKey, levels, routedActivityId, modeQuery }) => {
  const navigate = useNavigate()
  const params = useAppParams()
  const level = activity.level ?? 1
  const keys = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().split('-')[0]
    const skip = new Set(['or', 'and', 'hold', 'after', 'touch', 'midi'])
    const set = new Set<string>()
    for (const item of activity.keypress as (string | Key | Key[])[]) {
      if (Array.isArray(item)) {
        for (const tok of item) {
          const n = normalize(String(tok))
          if (!skip.has(n)) set.add(n)
        }
      } else {
        const n = normalize(String(item))
        if (!skip.has(n)) set.add(n)
      }
    }
    return set
  }, [activity])
  const matchedKey = (() => {
    if (!highlightKey) return undefined
    const n = highlightKey.toLowerCase().split('-')[0]
    return keys.has(n) ? n : undefined
  })()

  const qs = (() => {
    const parts: string[] = []
    if (highlightKey) parts.push(`key=${encodeURIComponent(highlightKey)}`)
    if (levels && levels.size > 0) parts.push(`levels=${[...levels].sort().join('')}`)
    if (modeQuery) parts.push(`mode=${modeQuery}`)
    return parts.length ? `?${parts.join('&')}` : ''
  })()

  return (
    <div
      className={cx(
        entryClass,
        'entry',
        matchedKey && `keycolor-${matchedKey}`,
        params.screen === screen.id && routedActivityId === activity.id && 'active',
      )}
      onClick={(evt) => {
        evt.stopPropagation()
        const effectiveMode = modeQuery ?? params.mode ?? 'full'
        navigate(`/${screen.id}/${activity.id}/${effectiveMode}${qs}`)
      }}
    >
      <h3>
        <span className={cx(badgeClass, `lvl-${level}`)} title={`Expertise level ${level}`}>{level}</span>
        <span className="title">{activity.name}</span>
        <span className="combo">
          <KeyCombo keypress={activity.keypress} id={`${screen.id}-${activity.id}`} />
        </span>
      </h3>
      {!activity.media && false && <img src={FALLBACK_IMAGE} />}
    </div>
  )
}

const categoryClass = css`
  scrollbar-gutter: stable;
  isolation: isolate;


  > h2 {
    background-color: ${style.themeColors.background.default};
    display: flex;
    align-items: center;
    position: sticky;
    top: 0px;
    padding: 24px 4px 4px 4px;
    margin: 0;
    border-bottom: 2px solid ${style.themeColors.line.default};
    z-index: 1;
  }
`

export const ActivityCategory: FC<{ screen: ScreenData; category: Category; activities: ActivityData[]; levels?: Set<number>; routedActivityId?: string; highlightKey?: string; modeQuery?: 'min' | 'full' }> = ({ screen, category, activities, levels, routedActivityId, highlightKey, modeQuery }) => {
  const filtered = activities.filter((x) => {
    const lvl = x.level ?? 1
    if (!levels || levels.size === 0) return true
    // Always include routed activity
    if (routedActivityId && x.id === routedActivityId) return true
    return levels.has(lvl)
  })

  return (
    <div className={cx(categoryClass, 'category')}>
      <h2>{category.name}</h2>
      {filtered.map((x) => (
        <ActivityEntry
          key={`${category.id}-${x.id}`}
          screen={screen}
          activity={x}
          highlightKey={highlightKey}
          levels={levels}
          routedActivityId={routedActivityId}
          modeQuery={modeQuery}
        />
      ))}
    </div>
  )
}

const activityClass = css`
  position: relative;
  background: ${style.themeColors.background.default};

  > .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 100%;
    width: fit-content;
    max-width: 550px;
    max-height: 100vh;
    margin-left: 20px;
    overflow-y: scroll;
    padding-right: 8px;
    > h3 {
      margin: 0 0 15px 0;
    }
  }

  > .sidebar-title {
    display: none;
  }

  @media (max-width: 900px) {
    & {
      max-width: 30px;
      padding-right: 30px;
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
        left: 20px;
        opacity: 0;
        transform: translateX(-100%);
        max-width: calc(90vw - 125px);
        transition: 0.25s ease transform, 0.25s 0.1s ease opacity;
        pointer-events: none;
        padding-right: 30px;
        border-right: 1px solid ${style.themeColors.line.default};
        min-height: calc(100% - 45px);

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
  }

  &.minified {
    max-width: 30px;
    padding-right: 30px;
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
      left: 20px;
      opacity: 0;
      transform: translateX(-100%);
      max-width: calc(90vw - 125px);
      transition: 0.25s ease transform, 0.25s 0.1s ease opacity;
      pointer-events: none;
      padding-right: 30px;
      border-right: 1px solid ${style.themeColors.line.default};
      min-height: calc(100% - 45px);

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

export const ActivitySelection: FC = () => {
  const { screen, activity } = useAppParams()
  const { key, levels, mode: modeQuery } = useAppQuery()
  const { helper } = useDataset()

  const usedScreen = useMemo(() => helper?.resolveScreen(screen), [helper, screen])
  // In min mode, keep activities opened
  const modeClass = 'full'

  const categories = useMemo(() => (usedScreen && helper) ? helper.activityCategoriesForScreen(usedScreen) : [], [usedScreen, helper])
  const allActivities = useMemo(() => (usedScreen && helper) ? helper.activitiesForScreen(usedScreen) : [], [usedScreen, helper])
  const routedActivityResolvedId = useMemo(() => (usedScreen && helper) ? (helper.resolveActivityForScreen(usedScreen, activity)?.id) : undefined, [usedScreen, helper, activity])

  return (
    <div className={cx(activityClass, modeClass)}>
      <div className="content">
        <div className="sticky-fill" />
        {usedScreen && categories.map((cat) => {
          const acts = allActivities.filter((a) => a.categoryIds.includes(cat.id))
          return (
            <ActivityCategory
              key={cat.id}
              screen={usedScreen}
              category={cat}
              activities={acts}
              levels={levels}
              routedActivityId={routedActivityResolvedId}
              highlightKey={key ?? undefined}
              modeQuery={modeQuery}
            />
          )
        })}
      </div>
      <h3 className="sidebar-title">Activities</h3>
    </div>
  )
}
