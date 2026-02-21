import { useEffect, useMemo, useState } from 'react'
import type { Dataset, ScreenData, ResolvedActivity, Category, ActivityTemplate, ScreenActivityRef } from '../data/schema'

let cached: Dataset | null = null

/** Extract the activity ID from a screen activity ref */
const refId = (ref: ScreenActivityRef): string =>
    typeof ref === 'string' ? ref : ref.id

/** Resolve one activity ref into a ResolvedActivity by merging template + overrides + media paths */
function resolveRef(
    ref: ScreenActivityRef,
    template: ActivityTemplate,
    screen: ScreenData,
): ResolvedActivity {
    const mediaFolder = screen.mediaFolder ?? screen.id
    const overrides: { name?: string; description?: string; level?: 1 | 2 | 3 } = typeof ref === 'string' ? {} : ref
    const slug = (typeof ref === 'string' ? undefined : ref.media) ?? template.id

    return {
        ...template,
        name: overrides.name ?? template.name,
        description: overrides.description ?? template.description,
        level: overrides.level ?? template.level,
        media: {
            video: `/assets/activity/${mediaFolder}/${slug}.mp4`,
            eventsUrl: `/assets/activity/${mediaFolder}/${slug}.json`,
        },
    }
}

export const useDataset = () => {
    const [data, setData] = useState<Dataset | null>(cached)
    const [loading, setLoading] = useState(!cached)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (cached) return
        fetch('/m8-shortcuts.dataset.json')
            .then((res) => res.json())
            .then((json: Dataset) => {
                cached = json
                setData(json)
                setLoading(false)
            })
            .catch((err) => {
                setError(err)
                setLoading(false)
            })
    }, [])

    const helper = useMemo(() => {
        if (!data) {
            return null
        }
        const screenById = new Map<string, ScreenData>()
        for (const s of data.screens) screenById.set(s.id.toLowerCase(), s)

        const templateById = new Map<string, ActivityTemplate>()
        for (const a of data.activities) templateById.set(a.id, a)

        const screenCategories: Category[] = []
        const seenSC = new Set<string>()
        for (const s of data.screens) {
            for (const cid of s.categoryIds) {
                const c = data.categories.find((x) => x.id === cid)
                if (c && !seenSC.has(c.id)) {
                    seenSC.add(c.id)
                    screenCategories.push(c)
                }
            }
        }

        const activityCategories: Category[] = []
        const seenAC = new Set<string>()
        for (const a of data.activities) {
            for (const cid of a.categoryIds) {
                const c = data.categories.find((x) => x.id === cid)
                if (c && !seenAC.has(c.id)) {
                    seenAC.add(c.id)
                    activityCategories.push(c)
                }
            }
        }

        const resolveScreen = (idOrAlias?: string): ScreenData | undefined => {
            if (!idOrAlias) return undefined
            const t = idOrAlias.toLowerCase()
            const byId = screenById.get(t)
            if (byId) return byId
            return data.screens.find((s) => (s.aliases ?? []).some((a) => a.toLowerCase() === t))
        }

        const activitiesForScreen = (screen: ScreenData): ResolvedActivity[] => {
            const result: ResolvedActivity[] = []
            for (const ref of screen.activities) {
                const id = refId(ref)
                const template = templateById.get(id)
                if (template) {
                    result.push(resolveRef(ref, template, screen))
                }
            }
            return result
        }

        const resolveActivityForScreen = (screen: ScreenData, idOrAlias?: string): ResolvedActivity | undefined => {
            if (!idOrAlias) return undefined
            const t = idOrAlias.toLowerCase()
            for (const ref of screen.activities) {
                const id = refId(ref)
                if (id.toLowerCase() === t) {
                    const template = templateById.get(id)
                    if (template) return resolveRef(ref, template, screen)
                }
            }
            return undefined
        }

        const activityCategoriesForScreen = (screen: ScreenData): Category[] => {
            const acts = activitiesForScreen(screen)
            const ids = new Set<string>()
            const out: Category[] = []
            for (const a of acts) {
                for (const cid of a.categoryIds) {
                    if (!ids.has(cid)) {
                        ids.add(cid)
                        const cat = data.categories.find((c) => c.id === cid)
                        if (cat) out.push(cat)
                    }
                }
            }
            return out
        }

        return {
            screenCategories,
            activityCategories,
            resolveScreen,
            activitiesForScreen,
            resolveActivityForScreen,
            activityCategoriesForScreen,
        }
    }, [data])

    return { data, loading, error, helper }
}
