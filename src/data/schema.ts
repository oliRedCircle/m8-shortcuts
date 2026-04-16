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

/** A prerequisite device state (e.g. "Select Mode") shown as a badge on activities */
export interface State {
    id: string
    abbr: string   // Short label shown in badge, e.g. "SM"
    name: string   // Full name shown in tooltip, e.g. "Select Mode"
}

/** A rectangular zone on the M8 screen expressed in 40×24 text-grid coordinates */
export interface GridZone {
    x: number       // Column (0–39)
    y: number       // Row (0–23)
    w: number       // Width in columns
    h: number       // Height in rows
    label?: string  // Optional text label inside the zone
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
    prereqStateIds?: string[]
}

/** Per-screen activity reference: string = use template as-is; object = override fields */
export type ScreenActivityRef = string | {
    id: string
    media?: string
    description?: string
    name?: string
    level?: Level
    prereqStateIds?: string[]
    zones?: GridZone[]
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
    states: State[]
    keys: KeyDef[]
    assets: AssetRef[]
}

// --- Resolved (runtime) type ---

/** Activity with per-screen overrides applied and media paths resolved */
export interface ResolvedActivity extends ActivityTemplate {
    media: { video: string; eventsUrl: string }
    prereqStates?: State[]
    zones?: GridZone[]
}
