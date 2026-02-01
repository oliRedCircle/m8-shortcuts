import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'public', 'm8-shortcuts.dataset.json')
const OUT = path.join(process.cwd(), 'public', 'm8-shortcuts.dataset.refactored.json')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'))
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')

const kebab = (s) => s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const assetIdFromUrl = (url) => {
    const rel = url.replace(/^\/?src\/?assets\/?/i, '').replace(/^\//, '')
    const noExt = rel.replace(/\.[a-z0-9]+$/i, '')
    return noExt.replace(/\//g, '-')
}

const assetTypeFromUrl = (url) => {
    const ext = (url.split('.').pop() || '').toLowerCase()
    if (ext === 'mp4' || ext === 'webm' || ext === 'mov') return 'video'
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif') return 'image'
    if (ext === 'json') return 'json'
    return 'image'
}

const main = () => {
    const input = readJson(SRC)
    const out = { ...input }

    // Categories: ensure id + name
    if (Array.isArray(out.categories)) {
        out.categories = out.categories.map((c) => {
            const id = c.id ?? kebab(c.name ?? '')
            return { id, name: c.name ?? id }
        })
    }

    // Assets: ensure id + type + url
    if (Array.isArray(out.assets)) {
        out.assets = out.assets.map((a) => {
            const url = a.url
            const id = a.id ?? assetIdFromUrl(url)
            const type = a.type ?? assetTypeFromUrl(url)
            return { id, type, url }
        })
    }

    // Screens: ensure aliases present (optional) and arrays exist
    if (Array.isArray(out.screens)) {
        out.screens = out.screens.map((s) => ({
            id: s.id,
            name: s.name,
            aliases: Array.isArray(s.aliases) ? s.aliases : undefined,
            categoryIds: Array.isArray(s.categoryIds) ? s.categoryIds : [],
            description: s.description ?? '',
            img: s.img ?? '',
            activityIds: Array.isArray(s.activityIds) ? s.activityIds : [],
        }))
    }

    // Activities: ensure aliases/level/media structures, preserve existing
    if (Array.isArray(out.activities)) {
        out.activities = out.activities.map((a) => {
            const aliases = Array.isArray(a.aliases) ? a.aliases : undefined
            const categoryIds = Array.isArray(a.categoryIds) ? a.categoryIds : []
            const keypress = Array.isArray(a.keypress) ? a.keypress : []
            const description = typeof a.description === 'string' ? a.description : ''
            const level = typeof a.level === 'number' ? a.level : undefined
            let media
            if (a.media && typeof a.media === 'object') {
                if (a.media.video) {
                    media = { video: a.media.video, events: a.media.events ?? undefined }
                } else if (a.media.img) {
                    media = { img: a.media.img }
                }
            }
            return {
                id: a.id,
                name: a.name,
                aliases,
                categoryIds,
                keypress,
                description,
                level,
                media,
            }
        })
    }

    writeJson(OUT, out)
    console.log(`Refactored dataset written to ${OUT}`)
}

main()
