import { type FC, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FallbackScreen from '#assets/activity/no-screen-placeholder.png'
import { ActivitySelection } from './features/ActivitySelection'
import { M8Player } from './features/M8Player'
import { ScreenSelection } from './features/ScreenSelection'
import { useAppParams } from './features/useAppParams'
import { useAppQuery } from './features/useAppParams'
import { useDataset } from './hooks/useDataset'
import type { ActivityData } from './data/schema'

const ActivityScreen: FC<{ activity?: ActivityData; fallbackImg?: string }> = ({ activity, fallbackImg }) => {
  const usedActivity = activity
  const fallbackMedia = { img: fallbackImg ?? FallbackScreen }
  const media = usedActivity?.media ?? fallbackMedia
  const mediaData = 'img' in media
    ? { type: 'image' as const, img: media.img }
    : (() => {
      const v = media as { video: string; events?: [number, number][]; eventsUrl?: string }
      return { type: 'video' as const, video: v.video, events: v.events, eventsUrl: v.eventsUrl }
    })()
  return <M8Player title={usedActivity?.name ?? ''} media={mediaData} description={usedActivity?.description} />
}

export const Layout: FC = () => {
  const navigate = useNavigate()
  const parameters = useAppParams()
  const query = useAppQuery()
  const { data, helper } = useDataset()

  const screen = helper?.resolveScreen(parameters.screen) ?? (data?.screens[0] ?? undefined)
  const activity = screen && helper?.resolveActivityForScreen(screen, parameters.activity)

  useEffect(() => {
    if (!screen) return
    if (!activity) {
      const first = helper?.activitiesForScreen(screen)[0]
      if (first) {
        const effectiveMode = query.mode ?? parameters.mode ?? 'full'
        const qs: string[] = []
        if (query.key) qs.push(`key=${encodeURIComponent(query.key)}`)
        if (query.levels && query.levels.size > 0) qs.push(`levels=${[...query.levels].sort().join('')}`)
        if (query.mode) qs.push(`mode=${query.mode}`)
        const suffix = qs.length ? `?${qs.join('&')}` : ''
        navigate(`/${screen.id}/${first.id}/${effectiveMode}${suffix}`, { replace: true })
      }
    }
  }, [activity, screen, helper, navigate, parameters.mode, query.mode, query.key, query.levels])

  return (
    <>
      {(query.mode ?? parameters.mode) !== 'min' && <ScreenSelection />}
      <ActivitySelection />
      {screen && <ActivityScreen activity={activity} fallbackImg={screen.img} />}
    </>
  )
}
