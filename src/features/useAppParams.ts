import { useParams, useSearchParams } from 'react-router-dom'

type AppParameters = {
  screen: string
  activity: string
  mode?: 'min' | 'full'
}

export const useAppParams = useParams<AppParameters>

export const useAppQuery = (): { key?: string; levels: Set<number>; mode?: 'min' | 'full' } => {
  const [searchParams] = useSearchParams()

  // URL key param — used as fallback when SDK is not connected.
  // When SDK is connected, key highlighting is driven by data-sdk-key on <html> (see SdkContext),
  // which bypasses React rendering entirely for instant response.
  const key = searchParams.get('key') ?? undefined

  const modeParam = searchParams.get('mode') ?? undefined
  const mode = modeParam === 'min' ? 'min' : modeParam === 'full' ? 'full' : undefined
  const levelsParam = searchParams.get('levels') ?? undefined
  const levels = new Set<number>()
  if (levelsParam) {
    for (const ch of levelsParam) {
      const n = Number(ch)
      if (n === 1 || n === 2 || n === 3) levels.add(n)
    }
  }
  return { key, levels, mode }
}
