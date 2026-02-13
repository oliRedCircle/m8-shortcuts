import type {
    ActivityData,
    ActivityTemplate,
    CompactDataset,
    Dataset,
    ScreenActivityRef,
    ScreenData,
} from './schema'


export function resolveDataset(compact: CompactDataset): Dataset {
    const templateById = new Map<string, ActivityTemplate>()
    for (const t of compact.activities) {
        templateById.set(t.id, t)
    }

    const allActivities: ActivityData[] = []
    const screens: ScreenData[] = []

    for (const screen of compact.screens) {
        const mediaFolder = screen.mediaFolder ?? screen.id
        const activityIds: string[] = []

        for (const ref of screen.activities) {
            const { activityId, mediaSlug, overrides } = parseRef(ref)

            const template = templateById.get(activityId)
            if (!template) {
                console.warn(`[resolveDataset] Unknown activity "${activityId}" in screen "${screen.id}"`)
                continue
            }

            const compositeId = `${activityId}__${screen.id}`
            const slug = mediaSlug ?? activityId

            const resolved: ActivityData = {
                id: compositeId,
                name: overrides.name ?? template.name,
                aliases: [activityId],
                categoryIds: template.categoryIds,
                keypress: template.keypress,
                description: overrides.description ?? template.description,
                level: overrides.level ?? template.level,
                media: {
                    video: `/assets/activity/${mediaFolder}/${slug}.mp4`,
                    eventsUrl: `/assets/activity/${mediaFolder}/${slug}.json`,
                },
            }

            allActivities.push(resolved)
            activityIds.push(compositeId)
        }

        screens.push({
            id: screen.id,
            name: screen.name,
            aliases: screen.aliases,
            categoryIds: screen.categoryIds,
            description: screen.description,
            img: screen.img,
            activityIds,
        })
    }

    return {
        screens,
        activities: allActivities,
        categories: compact.categories,
        keys: compact.keys,
        assets: compact.assets,
    }
}

function parseRef(ref: ScreenActivityRef): {
    activityId: string
    mediaSlug: string | undefined
    overrides: { description?: string; name?: string; level?: 1 | 2 | 3 }
} {
    if (typeof ref === 'string') {
        return { activityId: ref, mediaSlug: undefined, overrides: {} }
    }
    return {
        activityId: ref.id,
        mediaSlug: ref.media,
        overrides: {
            description: ref.description,
            name: ref.name,
            level: ref.level,
        },
    }
}
