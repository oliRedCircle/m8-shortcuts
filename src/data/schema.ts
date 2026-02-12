// Schema types for dynamic dataset
import type { ReactNode } from 'react'
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

export interface ActivityData {
    id: string
    name: string
    aliases?: string[]
    categoryIds: string[]
    keypress: (Key | Key[] | 'and' | 'after' | 'or' | 'hold' | '1x' | '2x' | '3x' | 'touch' | 'midi')[]
    description: ReactNode
    assetIds?: string[]
    level?: Level
    common?: boolean
    media?: { img: string } | { video: string; events?: [number, number][]; eventsUrl?: string }
}

export interface ScreenData {
    id: string
    name: string
    aliases?: string[]
    categoryIds: string[]
    description: string
    img: string
    activityIds: string[]
}

export interface Dataset {
    screens: ScreenData[]
    activities: ActivityData[]
    categories: Category[]
    keys: KeyDef[]
    assets: AssetRef[]
}
