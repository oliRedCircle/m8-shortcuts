// Schema types for dynamic dataset
import type { Key } from '../components/Keypress'

export type Level = 1 | 2 | 3

export interface AssetRef {
    id: string
    type: 'image' | 'video' | 'json'
    url: string
}

export interface Category {
    id: string
    name: string
}

export interface KeyDef {
    id: string
    name: string
    classes: string[] // includes xx-hold variants
}

// --- Compact (JSON) types ---

export type KeypressToken = Key | Key[] | '2x' | '3x' | 'and' | 'after' | 'or' | 'hold' | 'touch' | 'midi'

/** Activity template — defined once, shared across screens */
export interface ActivityTemplate {
    id: string
    name: string
    categoryIds: string[]
    keypress: KeypressToken[]
    description: string
    level?: Level
}

/** Per-screen activity reference: string = use template as-is; object = override fields */
export type ScreenActivityRef = string | {
    id: string
    media?: string
    description?: string
    name?: string
    level?: Level
}

/** Screen in the compact JSON format */
export interface ScreenData {
    id: string
    name: string
    aliases?: string[]
    categoryIds: string[]
    description: string
    img: string
    mediaFolder?: string // defaults to screen.id
    activities: ScreenActivityRef[]
}

/** Compact JSON dataset (what's stored in the file) */
export interface Dataset {
    screens: ScreenData[]
    activities: ActivityTemplate[]
    categories: Category[]
    keys: KeyDef[]
    assets: AssetRef[]
}

// --- Resolved (runtime) type ---

/** Activity with per-screen overrides applied and media paths resolved */
export interface ResolvedActivity extends ActivityTemplate {
    media: { video: string; eventsUrl: string }
}
