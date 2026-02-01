import type { Dataset, ActivityData, ScreenData, Category } from './schema'
import { screens, categories as screenCategories } from '../features/screen'
import { activityCategories } from '../features/activity'
import type { Activity as ActivitySrc } from '../features/activity'
import type { M8Screen } from '../features/screen'

const toId = (id: string) => id

const normalizeUrl = (u: string | undefined): string | undefined => {
    if (!u) return u
    const s = u.replace(/\\/g, '/')
    if (s.includes('/src/assets/')) {
        return `/assets/${s.split('/src/assets/')[1]}`
    }
    if (s.includes('/public/assets/')) {
        return `/assets/${s.split('/public/assets/')[1]}`
    }
    if (s.includes('/public/')) {
        return `/${s.split('/public/')[1]}`
    }
    const idx = s.indexOf('/assets/')
    if (idx >= 0) return s.slice(idx)
    return s.startsWith('/') ? s : `/${s}`
}

const inferLevel = (activity: ActivityData): 1 | 2 | 3 => {
    const kp = activity.keypress
    const rawTokens = kp
        .flatMap((k) => (Array.isArray(k) ? k : [k]))
        .map((t) => String(t).toLowerCase())
    const directional = new Set(['up', 'down', 'left', 'right'])
    const normalizeToken = (t: string) => (directional.has(t) ? 'dir' : t)
    const tokens = rawTokens
        .map((t) => normalizeToken(t))

    // Counts & features
    const simultaneousCombos = kp
        .filter((k) => Array.isArray(k))
        .map((arr) => (arr as string[]).map((t) => normalizeToken(String(t).toLowerCase())))
    const combosCount = simultaneousCombos.length
    const bigCombosCount = simultaneousCombos.filter((arr) => arr.length >= 3).length
    const altCount = rawTokens.filter((t) => t === 'or').length
    const sequenceCount = tokens.filter((t) => t === 'after' || t === 'before').length
    const repeat2xCount = tokens.filter((t) => t === '2x').length
    const repeat3xCount = tokens.filter((t) => t === '3x').length
    const holdsCount = tokens.filter((t) => t.includes('hold')).length
    const advancedModifiers = tokens.filter((t) => t === 'touch' || t === 'midi').length
    const uniqueKeys = new Set(tokens.filter((t) => !['or', 'after', 'before', '2x', '3x'].includes(t))).size

    // Description complexity
    const desc = (activity.description || '').toLowerCase()
    const descLen = desc.length
    const descKeywords = [
        'deep clone',
        'render',
        'quantize',
        'snapshot',
        'interpolate',
        'randomize',
        'assign',
        'recall',
        'limiter',
        'eq',
        'table',
        'instrument',
        'first',
        'when',
        'with',
        'includes',
        'selection',
    ]
    const descKeywordHits = descKeywords.reduce((acc, k) => acc + (desc.includes(k) ? 1 : 0), 0)

    // Score weights tuned for 1–3 banding
    let score = 0
    score += combosCount * 0.9
    score += bigCombosCount * 1.1
    // 'or' alternates often indicate simple direction alternatives;
    score += altCount * 0.05
    score += sequenceCount * 0.8
    score += repeat2xCount * 0.5
    score += repeat3xCount * 0.9
    score += holdsCount * 0.9
    score += advancedModifiers * 1.1
    if (uniqueKeys >= 5) score += 0.5
    if (descLen > 200) score += 0.5
    if (descLen > 360) score += 0.6
    score += Math.min(3, descKeywordHits) * 0.35

    // Map score to level
    if (score >= 3.1) return 3
    if (score >= 1.9) return 2
    return 1
}

export const buildDataset = (): Dataset => {
    // Aliases from M8 view names mapped to our screen ids
    const viewAliases: Record<string, string[]> = {
        'chain': ['chain'],
        'fx-settings': ['effectsettings'],
        'groove': ['groove'],
        'instrument-mods': ['instmods'],
        'instrument': ['inst', 'loadinstrument', 'instrumentpool'],
        'mixer': ['mixer'],
        'phrase': ['phrase'],
        'project': ['project'],
        'scale': ['scale'],
        'song': ['song'],
        'table': ['table'],
        'equalizer-bank': ['mixeq', 'modfxeq', 'delayeq', 'reverbeq'],
        'scope': ['limiterscope', 'mixscope'],
        'file-browser': ['selectsavedirectory', 'createdirectory'],
        'system-settings': ['systemsettings'],
    }
    const categories: Category[] = []
    for (const c of screenCategories) {
        categories.push({ id: c.id, name: c.name })
    }
    for (const c of activityCategories) {
        categories.push({ id: c.id, name: c.title })
    }

    const activitiesOut: ActivityData[] = []

    const screensOut: ScreenData[] = (screens as Readonly<M8Screen[]>).map((screen) => {
        const activityIds: string[] = []
        for (const act of screen.activities as Readonly<ActivitySrc[]>) {
            // Create a per-screen unique activity id to preserve screen-specific media
            const uniqueId = `${toId(act.id)}__${toId(screen.id)}`
            const a: ActivityData = {
                id: uniqueId,
                name: typeof act.title === 'string' ? act.title : act.id,
                aliases: [act.id, ...(act.aliases ?? [])],
                categoryIds: act.categories,
                keypress: act.keypress,
                description: act.description,
                media: act.media && ('video' in act.media)
                    ? (() => {
                        const v = normalizeUrl(act.media.video) ?? act.media.video
                        const eurl = v ? v.replace(/\.mp4$/i, '.json') : undefined
                        return { video: v, eventsUrl: eurl }
                    })()
                    : act.media && ('img' in act.media)
                        ? (() => {
                            const imgSrc = (act.media as { img: string }).img
                            return { img: normalizeUrl(imgSrc) ?? imgSrc }
                        })()
                        : undefined,
            }
            a.level = inferLevel(a)
            // Assets (video) per screen
            // no assets collection; URLs are web-relative
            activityIds.push(a.id)
            activitiesOut.push(a)
        }
        const s: ScreenData = {
            id: toId(screen.id),
            name: screen.name,
            aliases: (() => {
                const base = (screen.aliases ?? []).map((a) => a.toLowerCase())
                const extra = (viewAliases[screen.id] ?? []).map((a) => a.toLowerCase())
                const set = new Set<string>([...base, ...extra])
                return [...set]
            })(),
            categoryIds: screen.categories,
            description: screen.description,
            img: normalizeUrl(screen.img) ?? '',
            activityIds,
        }
        return s
    })

    const dataset: Dataset = {
        screens: screensOut,
        activities: activitiesOut,
        categories,
        keys: [],
        assets: [],
    }
    return dataset
}
