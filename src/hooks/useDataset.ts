import { useEffect, useMemo, useState } from 'react'
import type { Dataset, ScreenData, ActivityData, Category } from '../data/schema'

let cached: Dataset | null = null

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
        const activityById = new Map<string, ActivityData>()
        for (const a of data.activities) activityById.set(a.id.toLowerCase(), a)

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

        const resolveActivity = (idOrAlias?: string): ActivityData | undefined => {
            if (!idOrAlias) return undefined
            const t = idOrAlias.toLowerCase()
            const byId = activityById.get(t)
            if (byId) return byId
            return data.activities.find((a) => (a.aliases ?? []).some((al) => al.toLowerCase() === t))
        }

        const resolveActivityForScreen = (screen: ScreenData, idOrAlias?: string): ActivityData | undefined => {
            if (!idOrAlias) return undefined
            const t = idOrAlias.toLowerCase()
            // Search within this screen's activities only
            const acts = activitiesForScreen(screen)
            return acts.find((a) => a.id.toLowerCase() === t || (a.aliases ?? []).some((al) => al.toLowerCase() === t))
        }

        const activitiesForScreen = (screen: ScreenData): ActivityData[] => {
            return screen.activityIds
                .map((aid) => activityById.get(aid.toLowerCase()))
                .filter((x): x is ActivityData => !!x)
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
            resolveActivity,
            resolveActivityForScreen,
            activitiesForScreen,
            activityCategoriesForScreen,
        }
    }, [data])

    return { data, loading, error, helper }
}
