import { type FC, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
// Assets served from public; use absolute URL string
const FALLBACK_SCREEN = '/assets/activity/no-screen-placeholder.png'
import { ActivitySelection } from './features/ActivitySelection'
import { M8Player } from './features/M8Player'
import { ScreenSelection } from './features/ScreenSelection'
import { useAppParams } from './features/useAppParams'
import { useAppQuery } from './features/useAppParams'
import { useDataset } from './hooks/useDataset'
import type { ResolvedActivity } from './data/schema'
import { useSdkContext } from './contexts/SdkContext'

const ActivityScreen: FC<{ activity?: ResolvedActivity; fallbackImg?: string }> = ({ activity, fallbackImg }) => {
  const media = activity?.media
  if (!media) {
    return <M8Player title="" media={{ type: 'image', img: fallbackImg ?? FALLBACK_SCREEN }} description={undefined} />
  }
  return <M8Player title={activity.name} media={{ type: 'video', video: media.video, eventsUrl: media.eventsUrl }} description={activity.description} />
}

export const Layout: FC = () => {
  const navigate = useNavigate()
  const parameters = useAppParams()
  const query = useAppQuery()
  const { data, helper } = useDataset()
  const { isConnected, sdkViewName } = useSdkContext()

  const screen = helper?.resolveScreen(parameters.screen) ?? (data?.screens[0] ?? undefined)
  const activity = screen && helper?.resolveActivityForScreen(screen, parameters.activity)

  // Navigate to the first activity of the current screen when no activity is selected
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

  // Navigate to the correct screen when the SDK reports a view change
  useEffect(() => {
    if (!isConnected || !sdkViewName || !helper) return
    const sdkScreen = helper.resolveScreen(sdkViewName)
    if (!sdkScreen) return
    // Only navigate if we're on a different screen
    if (parameters.screen === sdkScreen.id) return
    const first = helper.activitiesForScreen(sdkScreen)[0]
    if (!first) return
    const effectiveMode = query.mode ?? parameters.mode ?? 'min'
    const qs: string[] = []
    if (query.levels && query.levels.size > 0) qs.push(`levels=${[...query.levels].sort().join('')}`)
    if (query.mode) qs.push(`mode=${query.mode}`)
    const suffix = qs.length ? `?${qs.join('&')}` : ''
    navigate(`/${sdkScreen.id}/${first.id}/${effectiveMode}${suffix}`, { replace: true })
  }, [isConnected, sdkViewName, helper, parameters.screen, navigate, query.mode, query.levels, parameters.mode])

  return (
    <>
      {(query.mode ?? parameters.mode) !== 'min' && <ScreenSelection />}
      <ActivitySelection />
      {screen && <ActivityScreen activity={activity} fallbackImg={screen.img} />}
    </>
  )
}
