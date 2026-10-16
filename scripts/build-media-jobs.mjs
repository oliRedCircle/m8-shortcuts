// Builds scripts/media-jobs.json: one recording job per shortcut placement. Each job says where the M8 must be
// before the clip starts (its context: screen, cursor cell, play state, instrument type, clipboard...) and what a
// person would play on the keys (its choreography), timed like the hand-recorded clips. See MEDIA_GENERATION_PLAN.md.
// Run from m8-shortcuts:
//
//   node scripts/build-media-jobs.mjs                 write scripts/media-jobs.json and print the listing
//   node scripts/build-media-jobs.mjs --list          print the listing only
//   --all                    also list every placement that already has a video (re-record everything)
//   --generated              also list clips the runner made earlier (untracked or modified in git)
//   --redo song/play,phrase/edit-large   also list these placements although they have a video
//   --screens project,song   only these screens
//   --seed 2                 another take: every job gets different (still human) timing
//   --pace 1.6               how slowly the person plays: pauses and looks are multiplied by it (default 1.4)
//   --yam8d ../yam8d         where m8Graph.generated.json lives
//   --out other.json         write somewhere else than scripts/media-jobs.json
//
// Re-recorded clips need "Overwrite existing files" ticked in the runner (yam8d/public/media-capture.html).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const argValue = (name) => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
}
const listOnly = args.includes('--list')
const yam8dRoot = resolve(root, argValue('--yam8d') ?? '../yam8d')
const redoAll = args.includes('--all')
const redoGenerated = args.includes('--generated')
const redo = new Set((argValue('--redo') ?? '').split(',').map((x) => x.trim()).filter(Boolean))
const onlyScreens = new Set((argValue('--screens') ?? '').split(',').map((x) => x.trim()).filter(Boolean))
const seed = Number(argValue('--seed') ?? 1)
const pace = Number(argValue('--pace') ?? 1.4)

const datasetPath = join(root, 'public', 'm8-shortcuts.dataset.json')
const activityDir = join(root, 'public', 'assets', 'activity')
const graphPath = join(yam8dRoot, 'public', 'm8Graph.generated.json')
const outPath = argValue('--out') ? resolve(argValue('--out')) : join(root, 'scripts', 'media-jobs.json')

// Key bits, identical to yam8d/src/features/connection/keys.ts.
const KEY = { left: 0x80, up: 0x40, down: 0x20, shift: 0x10, play: 0x08, right: 0x04, opt: 0x02, edit: 0x01 }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

// ---------- human timing ----------
//
// Measured on the 214 hand-recorded timelines (scripts untouched since the last commit): a tap lasts p50 96 ms
// (p10 77, p90 128); the gap between two keys is bimodal, p50 241 ms (quick repeats ~130 ms, deliberate moves
// 300-700 ms); a modifier is held p50 288 ms (p10 128, p90 497) before the first key; the last key is released
// p50 144 ms (p10 48, p90 512) before the modifier; the first press comes p50 712 ms (p10 338, p90 1103) into the
// clip. Each value is drawn from a log-normal distribution: [median ms, log-sigma, min, max]. Those clips are quick
// for someone who has not seen the shortcut yet, so every pause and look (not the taps themselves, and not double
// taps, which the M8 must still read as double) is multiplied by `pace`.
const HUMAN = {
    tap: [96, 0.18, 65, 160],
    repeat: [150, 0.25, 90, 280], // same key again in a series
    move: [290, 0.35, 150, 650], // a deliberate next key
    think: [480, 0.3, 300, 950], // between two parts of a gesture (select, then act)
    lead: [270, 0.35, 120, 520], // modifier down -> first key down
    tail: [140, 0.5, 50, 450], // last key up -> modifier up
    stagger: [170, 0.3, 90, 330], // second modifier after the first one
    start: [250, 0.6, 60, 600], // added to the runner's pre-roll: first press ~650-1200 ms into the clip
}
const PRE_ROLL_MS = 600
const POST_ROLL_MS = 900
// The M8 link sends one key state every 20 ms (yam8d connection.ts): keep events at least this far apart.
const MIN_EVENT_GAP_MS = 30

const hashText = (text) => {
    let h = 2166136261
    for (const ch of text) {
        h ^= ch.charCodeAt(0)
        h = Math.imul(h, 16777619)
    }
    return h >>> 0
}
const mulberry32 = (s) => () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * One take of a gesture: keys go down and up on a clock with human timing. `steps()` returns the [dt, mask] list
 * the runner plays (the full held-key state at each change, ending at 0).
 */
class Take {
    constructor(rng) {
        this.rng = rng
        this.t = 0
        this.held = []
        this.steps = []
    }
    sample([median, sigma, min, max]) {
        const u = Math.max(this.rng(), 1e-9)
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rng())
        return Math.round(Math.min(max, Math.max(min, median * Math.exp(sigma * z))))
    }
    between(a, b) {
        return Math.round(a + (b - a) * this.rng())
    }
    wait(ms) {
        this.t += ms
        return this
    }
    /** A pause at the clip's pace. */
    pause(ms) {
        return this.wait(Math.round(ms * pace))
    }
    emit() {
        const mask = this.held.reduce((m, k) => m | KEY[k], 0)
        const last = this.steps[this.steps.length - 1]
        if (last && last[1] === mask) return
        if (last && this.t < last[0] + MIN_EVENT_GAP_MS) this.t = last[0] + MIN_EVENT_GAP_MS
        this.steps.push([Math.round(this.t), mask])
    }
    down(key) {
        if (!this.held.includes(key)) {
            this.held.push(key)
            this.emit()
        }
        return this
    }
    up(key) {
        if (this.held.includes(key)) {
            this.held = this.held.filter((k) => k !== key)
            this.emit()
        }
        return this
    }
    tap(key, ms) {
        return this.down(key).wait(ms ?? this.sample(HUMAN.tap)).up(key)
    }
    /** A series on one key; people speed up a little after the second press. */
    taps(key, n) {
        for (let i = 0; i < n; i++) {
            if (i) this.pause(Math.round(this.sample(HUMAN.repeat) * (i > 1 ? 0.9 : 1)))
            this.tap(key)
        }
        return this
    }
    move() {
        return this.pause(this.sample(HUMAN.move))
    }
    think() {
        return this.pause(this.sample(HUMAN.think))
    }
    look(min, max) {
        return this.pause(this.between(min, max))
    }
    begin() {
        return this.pause(this.sample(HUMAN.start))
    }
    /** Holds modifiers (in order), plays `body`, releases them last-pressed first (the M8 cares, see latch). */
    hold(mods, body) {
        mods.forEach((m, i) => {
            if (i) this.pause(this.sample(HUMAN.stagger))
            this.down(m)
        })
        this.pause(this.sample(HUMAN.lead))
        body?.()
        this.pause(this.sample(HUMAN.tail))
        ;[...mods].reverse().forEach((m, i) => {
            if (i) this.wait(this.between(40, 110))
            this.up(m)
        })
        return this
    }
    chord(mods, key) {
        return this.hold(mods, () => this.tap(key))
    }
    /**
     * Mute/solo with the release order that decides what stays: OPTION down, the key down, both held `holdMs`
     * (muted or soloed while held), then OPTION released first, which keeps it (or removes one kept earlier), and the
     * key last (manual p.11). Releasing the key first would undo it. The hold is not paced.
     */
    latch(mod, key, holdMs = this.between(160, 260)) {
        return this.down(mod).pause(this.sample(HUMAN.lead)).down(key).wait(holdMs).up(mod).wait(this.between(70, 150)).up(key)
    }
    doubleTap(key) {
        return this.tap(key, this.between(70, 100)).wait(this.between(80, 130)).tap(key, this.between(70, 100))
    }
    tripleTap(key) {
        return this.doubleTap(key).wait(this.between(80, 130)).tap(key, this.between(70, 100))
    }
    result() {
        while (this.held.length) this.up(this.held[this.held.length - 1])
        return this.steps
    }
}

// Gesture pieces shared by many shortcuts.
const editBackForth = (c, a, b, n = 2) => c.hold(['edit'], () => c.taps(a, n).look(350, 650).taps(b, n))
const optBackForth = (c, a, b, n = 2) => c.hold(['opt'], () => c.taps(a, n).look(500, 900).taps(b, n))
const enterSelection = (c, rows, cols = 0) => {
    c.chord(['shift'], 'opt').look(250, 450)
    if (rows) c.taps('down', rows)
    if (cols) c.move().taps('right', cols)
    return c
}
const clearMutes = (c) => c.hold(['opt', 'shift'], () => c.tap('play'))
/**
 * Option copies the selection and leaves Select Mode; the M8 then puts the cursor on the row below the selected
 * block, ready to paste (Song and Phrase views): walk back up so the clip loops. Gestures that only work inside
 * the selection end in Select Mode instead (the runner leaves it after the recording).
 */
const copyAndReturn = (c, rows) => c.tap('opt').look(500, 800).taps('up', rows + 1)

// ---------- screens ----------

// m8-shortcuts screen id -> view name known to yam8d's navigateToView (the 12 graph nodes).
const YAM8D_VIEW = {
    project: 'project',
    song: 'song',
    chain: 'chain',
    phrase: 'phrase',
    table: 'table',
    groove: 'groove',
    scale: 'scale',
    instrument: 'inst',
    'instrument-pool': 'instrumentpool',
    'instrument-mods': 'instmods',
    'fx-settings': 'effectsettings',
    mixer: 'mixer',
}

// View names the SDK reports on each screen (checked on a Model:02, firmware 6.5).
const VIEWS = {
    ...Object.fromEntries(Object.entries(YAM8D_VIEW).map(([k, v]) => [k, [v]])),
    'midi-settings': ['midisettings'],
    'midi-mappings': ['midimapping'],
    'render-audio': ['renderaudio'],
    'time-stats': ['timestats'],
    'system-settings': ['systemsettings'],
    theme: ['themesettings'],
    'file-browser': ['loadproject'],
    'equalizer-bank': ['mixeq'],
    scope: ['mixscope', 'limiterscope'],
    'sample-editor': ['sample'],
}

// How to reach the screens that are not graph nodes: from a parent screen, put the cursor on the entry and press
// the key. Positions measured on the device (Project rows 11-20, Mixer column 28, Instrument row 9).
const ROUTES = {
    'midi-settings': { from: 'project', steps: [{ cursor: [14, 11] }, { press: ['edit'] }] },
    'midi-mappings': { from: 'project', steps: [{ cursor: [23, 11] }, { press: ['edit'] }] },
    'file-browser': { from: 'project', steps: [{ cursor: [14, 14] }, { press: ['edit'] }] },
    'render-audio': { from: 'project', steps: [{ cursor: [14, 15] }, { press: ['edit'] }] },
    'time-stats': { from: 'project', steps: [{ cursor: [14, 19] }, { press: ['edit'] }] },
    'system-settings': { from: 'project', steps: [{ cursor: [14, 20] }, { press: ['edit'] }] },
    theme: { from: 'system-settings', steps: [{ cursor: [16, 7] }, { press: ['edit'] }] },
    // navigateTo cannot reach the EQ entry directly: go to MIX below it, then Up.
    'equalizer-bank': { from: 'mixer', steps: [{ cursor: [28, 17] }, { press: ['up'] }, { press: ['shift', 'right'] }] },
    scope: { from: 'mixer', steps: [{ cursor: [28, 17] }, { press: ['shift', 'right'] }] },
    'sample-editor': { from: 'instrument', steps: [{ instrument: 'SAMPLER' }, { cursor: [26, 9] }, { press: ['edit'] }] },
}

/** Flattens a route down to a graph view: [{ view }, ...steps, { expect: [...] }, ...]. */
const routeFor = (screenId) => {
    if (YAM8D_VIEW[screenId]) return [{ view: YAM8D_VIEW[screenId] }, { expect: VIEWS[screenId] }]
    const r = ROUTES[screenId]
    if (!r) return null
    return [...routeFor(r.from), ...r.steps, { expect: VIEWS[screenId] }]
}
const baseView = (screenId) => (YAM8D_VIEW[screenId] ? YAM8D_VIEW[screenId] : ROUTES[screenId] ? baseView(ROUTES[screenId].from) : null)

// How the cursor moves around each screen in a navigation clip (it must come back to its start to loop). Down comes
// first wherever the screen has rows below the start, as in the hand-recorded clips. The start cell is the first
// cell of the grid, so a trip that is longer than the screen only clamps and still comes back.
const NAV_MOVES = {
    grid: [['down', 4], ['right', 3], ['up', 4], ['left', 3]],
    twoColumns: [['down', 4], ['right', 1], ['up', 4], ['left', 1]],
    column: [['down', 4], ['up', 4]],
    row: [['right', 3], ['left', 3]],
}
const NAV_KIND = {
    song: 'grid', phrase: 'grid', table: 'grid', 'instrument-pool': 'grid', 'equalizer-bank': 'grid', 'midi-mappings': 'grid',
    chain: 'twoColumns', 'instrument-mods': 'twoColumns',
    mixer: 'row', 'time-stats': 'row', scope: 'row',
}
// Screens whose layout is not a plain grid or row: their own trips (the hand-recorded clips did the same).
const NAV_MOVES_OWN = {
    // One row down (the effect volumes; the rows below them are not aligned with the tracks), then along the tracks.
    mixer: [['down', 1], ['up', 1], ['right', 3], ['left', 3]],
    // From Zoom, down into the scope parameters and back, then across to Peak.
    scope: [['down', 2], ['up', 2], ['right', 2], ['left', 2]],
    // Each band is 5 rows high and 8 columns wide.
    'equalizer-bank': [['down', 4], ['right', 2], ['up', 4], ['left', 2]],
}

// Where a clip that needs "a value" (or any cell) starts when the shortcut's zone is the whole content area: a cell
// whose change is easy to see and harmless. TYPE (instrument), FONT OPTIONS (system settings) and the modulator
// type are never targeted: changing them reshapes the screen or resets parameters.
const START_CELL = {
    project: { near: { x: 14, y: 5 } }, // tempo
    instrument: { near: { x: 9, y: 13 }, zoneLabels: ['Parameters'] },
    'instrument-mods': { near: { x: 6, y: 8 } },
    mixer: { near: { x: 7, y: 12 } }, // track 3 volume
    'fx-settings': { near: { x: 22, y: 8 } },
    'render-audio': { near: { x: 17, y: 7 } },
    'midi-settings': { near: { x: 16, y: 8 } },
    'system-settings': { near: { x: 16, y: 10 }, avoid: [{ x: 16, y: 5, w: 17, h: 2 }] },
    theme: { near: { x: 15, y: 9 } },
    'sample-editor': { near: { x: 14, y: 14 } },
    'equalizer-bank': { near: { x: 7, y: 17 } },
    'midi-mappings': { fallback: 'any' }, // a song may have no mapping: edit an empty row then
}

// Where the runner looks for other content when the screen has no cell the job can use. Phrase and Chain: from
// the Song cells (Shift+Right into the chain, again into its first phrase, then Opt+Down through the chain's other
// phrases); Option+arrows alone stay inside one chain. Table: the next tables (Opt+Right).
const SEEK = {
    phrase: { kind: 'song', hops: 2, inChain: 2 },
    chain: { kind: 'song', hops: 1, inChain: 0 },
    table: Array(15).fill(['opt', 'right']),
}

// ---------- placements, resolved the same way as src/hooks/useDataset.ts ----------

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const refId = (ref) => (typeof ref === 'string' ? ref : ref.id)

const dataset = readJson(datasetPath)
const graph = existsSync(graphPath) ? readJson(graphPath) : null
if (!graph) console.warn(`! ${graphPath} not found: navigate-views directions fall back to defaults`)
const templateById = new Map(dataset.activities.map((a) => [a.id, a]))

const isFullScreen = (zones) => zones.length === 1 && zones[0].w >= 40 && zones[0].h >= 23

const placements = []
for (const screen of dataset.screens) {
    const folder = screen.mediaFolder ?? screen.id
    for (const ref of screen.activities) {
        const template = templateById.get(refId(ref))
        if (!template) continue
        const own = typeof ref === 'string' ? {} : ref
        const zones = own.zones ?? template.zones ?? screen.defaultZones ?? []
        placements.push({
            screen,
            template,
            folder,
            slug: own.media ?? template.id,
            zones,
            // Global shortcuts work anywhere: start them on the screen's content area, not on a blank corner.
            workZones: isFullScreen(zones) ? (screen.defaultZones ?? zones) : zones,
            name: own.name ?? template.name,
            prereqStateIds: own.prereqStateIds ?? template.prereqStateIds ?? [],
        })
    }
}

const mediaPath = (p, ext) => join(activityDir, p.folder, `${p.slug}.${ext}`)
const hasVideo = (p) => existsSync(mediaPath(p, 'mp4'))
const hasEvents = (p) => existsSync(mediaPath(p, 'json'))

/** Clips whose .mp4 is untracked or modified in git: made by the runner since the last commit. */
const gitNew = new Set()
try {
    const out = execFileSync('git', ['status', '--porcelain', '-uall', '--', 'public/assets/activity'], { cwd: root, encoding: 'utf8' })
    for (const line of out.split(/\r?\n/)) {
        const m = /^(..) public\/assets\/activity\/(.+)\.mp4$/.exec(line)
        if (m && !m[1].includes('D')) gitNew.add(m[2])
    }
} catch {
    console.warn('git status failed: clips are not marked as new')
}

const zoneByLabel = (screen, label) => (screen.defaultZones ?? []).filter((z) => z.label === label)
const plain = (z) => ({ x: z.x, y: z.y, w: z.w, h: z.h, ...(z.label ? { label: z.label } : {}) })
const centre = (zone) => ({ x: zone.x + Math.floor(zone.w / 2), y: zone.y + Math.floor(zone.h / 2) })
// Notes, chains and FX are entered from the top of a grid, so a song's data sits near its zone's first cell: the
// centre of a phrase (row 08) is often empty, and copying or moving empty rows shows nothing.
const firstCell = (zone) => ({ x: zone.x, y: zone.y })

// ---------- choreographies ----------
//
// Each entry returns what the job needs: `perform(c)` plays the gesture on a Take, and the context the runner
// sets up first (all optional):
//   transport  'stopped' (default) or 'playing'
//   mute       'latched': the current track is muted before the clip (in the Song view)
//   presets    [{ view, cell: [x, y] }]: cursors put there first (Chain and Phrase show what is under the Song and
//              Chain cursors)
//   instrument 'filled' | 'NONE' | 'SAMPLER' | 'FMSYNTH' | 'HYPERSYN' (Instrument screen: page to such an instrument)
//   target     { zones, want, near, cmd, room }: the cell the cursor starts on (see core.findCandidates)
//   setup      extra unrecorded steps (copy something first, store a snapshot...)
//   restore    'none' | 'value' | 'reload' | 'reload-if-changed': how the project is put back after the clip
//   mirror     'vertical' | 'horizontal' | 'both': the runner flips the gesture when the value would clamp (high
//              value, or its first move does not change the value)
//   play       { tracks, skip }: where the runner starts the song (transport 'playing'): a Song cell of the first
//              of these tracks whose chain is not in `skip` (see PLAY_FROM)
//   loops      false when the clip cannot end where it started (it is still kept)
//   attended   a question for the person at the M8 (something the runner cannot set up)

const VALUE = 'value'
// The value column of each grid that interpolation works on (Volume, V, TIC).
const VALUE_COLUMN = { phrase: { x: 7, y: 6, w: 2, h: 16, label: 'Volume' }, table: { x: 6, y: 6, w: 2, h: 16, label: 'Volume' }, groove: { x: 3, y: 6, w: 2, h: 16, label: 'Ticks' } }
const EMPTY = 'empty'
const TBL_CMD = '^(TBL|TBX|GRV|GGR)$'

const navigateSpec = (p) => ({
    target: { want: 'any' },
    perform: (c) => {
        c.begin()
        ;(NAV_MOVES_OWN[p.screen.id] ?? NAV_MOVES[NAV_KIND[p.screen.id] ?? 'column']).forEach(([dir, n], i) => {
            if (i) c.move()
            c.taps(dir, n)
        })
    },
})

const pasteSpec = (p) => {
    if (p.screen.id === 'instrument') return instrumentPasteSpec()
    if (p.screen.id === 'instrument-pool') {
        const names = zoneByLabel(p.screen, 'Instrument')
        return {
            setup: [
                { op: 'target', label: 'an instrument to copy', target: { zones: names, want: VALUE } },
                { op: 'keys', label: 'copy it (Shift+Opt)', combo: ['shift', 'opt'] },
                { op: 'target', label: 'an empty slot to paste into', target: { zones: names, want: EMPTY } },
            ],
            target: null,
            // Paste, look, then Edit+Option clears the slot again: the M8 asks "CLEAR INSTRUMENT?", Edit says OK.
            perform: (c) => c.begin().chord(['shift'], 'edit').look(1100, 1500).chord(['edit'], 'opt').look(700, 1000).tap('edit').look(500, 800),
            restore: 'reload-if-changed',
        }
    }
    if (p.screen.id === 'equalizer-bank') {
        return {
            setup: [{ op: 'keys', label: 'copy this EQ bank first (Shift+Opt)', combo: ['shift', 'opt'] }],
            perform: (c) => c.begin().chord(['shift'], 'edit').look(900, 1300),
        }
    }
    // Grids: select a row or two, copy them (Option), go a few rows down, paste.
    return {
        target: { want: VALUE, near: { x: p.workZones[0].x, y: 8 }, room: { down: 6 } },
        // Copy two rows (Option: the cursor drops below them), step down once more, paste (the cursor drops below
        // the pasted rows), then walk back up to the start.
        perform: (c) => enterSelection(c.begin(), 1).think().tap('opt').look(500, 800).tap('down').think().chord(['shift'], 'edit').look(900, 1300).taps('up', 5),
        restore: 'reload',
    }
}

const instrumentPasteSpec = () => ({
    instrument: 'filled',
    setup: [
        { op: 'keys', label: 'copy this instrument (Shift+Opt)', combo: ['shift', 'opt'] },
        { op: 'instrument', label: 'an empty instrument slot to paste into', want: 'NONE' },
    ],
    target: { want: 'any' },
    // Paste, look, then the same keys again undo the paste (manual p.17), so the clip loops.
    perform: (c) => c.begin().chord(['shift'], 'edit').look(1200, 1600).chord(['shift'], 'edit').look(500, 800),
    restore: 'reload-if-changed',
})

const nameSpec = () => ({
    // An unused letter slot ("-"), so typing then deleting a letter leaves the name as it was.
    target: { want: 'dash', fallback: 'any' },
    // Hold Edit (the keyboard appears), pick a letter, release to type it, step back, Option+Edit deletes it.
    perform: (c) => c.begin().hold(['edit'], () => c.look(350, 600).taps('right', 2).move().tap('down').look(300, 500)).look(700, 1000).tap('left').move().chord(['opt'], 'edit').look(500, 800),
    restore: 'reload-if-changed',
})

// Sub-views (Scope, EQ, ...) leave when Option is released first, even after a long hold (checked on the device):
// keeping a mute or solo there always goes back to the parent view, with the mute kept. So those clips do what the
// hand-recorded Scope clip did: keep it (the view leaves), remove it, then re-enter the sub-view with its entry key.
// A release of Option 400 ms or more after the other keys does not leave, so clear-mutes keeps Option down a moment
// longer there; its mute is latched before entering the sub-view.
const isSubView = (p) => !!ROUTES[p.screen.id]
const optionLast = (c) => c.look(450, 650).up('opt')
const keptHold = (c) => c.between(1200, 1800)
/** The key that enters a sub-view from where leaving it puts the cursor (Shift+Right for EQ and Scope). */
const reentry = (p) => [...(ROUTES[p.screen.id]?.steps ?? [])].reverse().find((s) => s.press)?.press
// Mute and solo clips play a song, and the current track is the one that is muted or soloed. By convention chains 00
// (empty), FD and FE (stop) are reserved for silence, and track 1 is where every song starts: so the song starts on
// track 3 or 4, on a cell that holds a chain that sounds (the runner takes the first Song row that has one).
const PLAY_FROM = { tracks: [3, 4], skip: ['00', 'FD', 'FE'] }
const SOUNDING_CHAIN = `^(?!(?:${PLAY_FROM.skip.join('|')})$)[0-9A-F]{2}$`
const songTrackX = (track) => 4 + (track - 1) * 3 // Song view: 2 characters per cell, 3 columns per track
const [firstPlayTrack, lastPlayTrack] = [Math.min(...PLAY_FROM.tracks), Math.max(...PLAY_FROM.tracks)]
const PLAY_TRACKS_ZONE = { x: songTrackX(firstPlayTrack), y: 6, w: songTrackX(lastPlayTrack) - songTrackX(firstPlayTrack) + 2, h: 16, label: `Tracks ${firstPlayTrack}-${lastPlayTrack}` }
/** Song view: the cursor goes on a sounding chain of those tracks, so the mute applies to track 3 or 4. */
const playTarget = (p) => (p.screen.id === 'song' ? { zones: [PLAY_TRACKS_ZONE], want: SOUNDING_CHAIN, fallback: 'any', near: { x: PLAY_TRACKS_ZONE.x, y: PLAY_TRACKS_ZONE.y } } : undefined)
// Hold Option+key (muted while held), release Option first: it stays muted. Look, then the same gesture removes it.
const muteSpec = (key) => (p) => ({
    transport: 'playing',
    // Scope re-opens on MIX after leaving it: start there so the clip loops.
    target: p.screen.id === 'scope' ? { want: 'any', near: { x: 28, y: 17 } } : playTarget(p),
    perform: (c) => {
        c.begin().latch('opt', key, keptHold(c)).look(1300, 1900).latch('opt', key, c.between(600, 800)).look(400, 700)
        if (isSubView(p)) {
            const keys = reentry(p)
            c.chord(keys.slice(0, -1), keys[keys.length - 1]).look(500, 800)
        }
    },
    notes: isSubView(p) ? ['keeping the mute/solo leaves the sub-view (M8 behaviour); the clip re-enters it at the end'] : undefined,
})
const clearSpec = (p) =>
    isSubView(p)
        ? {
              transport: 'playing',
              mute: 'latched',
              target: playTarget(p),
              perform: (c) => optionLast(c.begin().down('opt').wait(c.sample(HUMAN.lead)).down('shift').wait(c.sample(HUMAN.stagger)).tap('play').wait(c.sample(HUMAN.tail)).up('shift')).look(700, 1000),
          }
        : { transport: 'playing', target: playTarget(p), perform: (c) => clearMutes(c.begin().latch('opt', 'shift', keptHold(c)).look(1000, 1400)).look(500, 800) }

const pagingStart = (p) =>
    p.screen.id === 'instrument' ? { zones: zoneByLabel(p.screen, 'Type'), want: 'any' } : p.screen.id === 'instrument-pool' ? { zones: zoneByLabel(p.screen, 'Instrument'), want: 'any', near: { x: 4, y: 6 } } : undefined

/** How long a preview key stays down: the M8 previews only while it is held. */
const previewHold = (c) => c.between(4000, 5000)

const SPECS = {
    'navigate-screen': navigateSpec,
    'move-slow': navigateSpec,
    'navigate-views': () => ({ target: { want: 'any' }, navigateViews: true }),

    play: () => ({ perform: (c) => c.begin().tap('play').look(1800, 2600).tap('play') }),
    'continue-song': () => ({ perform: (c) => c.begin().chord(['shift'], 'play').look(1800, 2600).tap('play') }),
    'mute-track': muteSpec('shift'),
    'solo-track': muteSpec('play'),
    'clear-all-mute-solo': clearSpec,
    'clear-mutes': clearSpec,
    'solo-tracks': () => ({
        transport: 'playing',
        // Track 4 (x 13), so there are tracks on both sides; on a chain that sounds.
        target: { want: SOUNDING_CHAIN, fallback: VALUE, near: { x: songTrackX(4), y: 8 } },
        // Option+Left solos the tracks left of the cursor only while held, whichever key is released first (checked
        // on the device): hold it a few seconds (not paced), then the right side the same way.
        perform: (c) => c.begin().hold(['opt'], () => c.tap('left', c.between(2500, 3500))).look(900, 1300).hold(['opt'], () => c.tap('right', c.between(2500, 3500))).look(500, 800),
    }),
    'live-mode': () => ({ perform: (c) => c.begin().chord(['shift'], 'left').look(1300, 1800).chord(['shift'], 'left') }),
    'stop-track': () => ({
        target: { want: VALUE, near: { x: 4, y: 8 } },
        // Live Mode on, cue the track, let it play, stop it, Live Mode off.
        perform: (c) => c.begin().chord(['shift'], 'left').look(600, 900).tap('play').look(1800, 2400).chord(['shift'], 'play').look(1000, 1400).chord(['shift'], 'left'),
    }),
    'cue-row': () => ({
        target: { want: VALUE, near: { x: 7, y: 8 } },
        // Start the song, go two rows down, cue that row (Left held + Play), stop, come back.
        perform: (c) => c.begin().tap('play').look(1000, 1400).taps('down', 2).move().hold(['left'], () => c.tap('play')).look(1600, 2200).tap('play').move().taps('up', 2).move().tap('right'),
        notes: ['Left moves the cursor one track to the left as well; the clip ends with Right to come back'],
        review: true,
    }),
    'show-track-time': () => ({ target: { want: VALUE }, perform: (c) => c.begin().down('opt').look(1400, 1900).up('opt').look(300, 500) }),
    bookmark: () => ({ target: { want: VALUE }, perform: (c) => c.begin().tripleTap('opt').look(1100, 1500).tripleTap('opt').look(300, 500) }),

    // Coarse and fine edits go 3-5 steps one way and as many back (a person does not count; 2 looked shy).
    'edit-small': (p) => ({ target: { want: VALUE, zones: p.screen.id === 'instrument-pool' ? zoneByLabel(p.screen, 'Mixer / EQ') : undefined }, perform: (c) => editBackForth(c.begin(), 'right', 'left', c.between(3, 5)), mirror: 'horizontal', restore: 'value' }),
    'edit-large': (p) => ({ target: { want: VALUE, zones: p.screen.id === 'instrument-pool' ? zoneByLabel(p.screen, 'Mixer / EQ') : undefined }, perform: (c) => editBackForth(c.begin(), 'up', 'down', c.between(3, 5)), mirror: 'vertical', restore: 'value' }),
    // Change the value first (two large steps, then a few small ones on top) so the reset is visible, then
    // Edit+Option puts the default back. Mirrored on both axes: a high value goes down in large and small steps.
    'set-default': (p) => ({
        target: { want: VALUE, zones: p.screen.id === 'instrument-pool' ? zoneByLabel(p.screen, 'Mixer / EQ') : undefined },
        perform: (c) => c.begin().hold(['edit'], () => c.taps('up', 2).move().taps('right', c.between(3, 4))).look(800, 1100).chord(['edit'], 'opt').look(900, 1300),
        mirror: 'both',
        restore: 'value',
    }),
    // Phrase: a note. Table: the N column is a transpose in hex, never a note name.
    'edit-octave': (p) => ({ target: { want: p.screen.id === 'table' ? VALUE : 'note' }, perform: (c) => editBackForth(c.begin(), 'up', 'down'), mirror: 'vertical', restore: 'value' }),
    'edit-note': (p) => ({ target: { want: p.screen.id === 'table' ? VALUE : 'note' }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal', restore: 'value' }),
    'edit-related': () => ({ target: { want: VALUE }, perform: (c) => editBackForth(c.begin(), 'up', 'down'), mirror: 'vertical', restore: 'value' }),
    'change-root-key': () => ({ target: { want: VALUE }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal', restore: 'value' }),
    'enable-key': () => ({ target: { want: '^ON$' }, perform: (c) => c.begin().tap('edit').look(900, 1300).tap('edit').look(300, 500) }),
    'name-project': nameSpec,
    'name-scale': nameSpec,
    'name-instrument': () => ({ ...nameSpec(), instrument: 'filled' }),

    'snapshot-create': () => ({ perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300) }),
    'snapshot-recall': () => ({
        setup: [{ op: 'keys', label: 'store a snapshot first, so recalling it changes nothing (Shift+Opt)', combo: ['shift', 'opt'] }],
        perform: (c) => c.begin().chord(['shift'], 'edit').look(900, 1300),
    }),

    'step-slow': () => ({ target: { want: 'any', near: { x: 1, y: 6 } }, perform: (c) => c.begin().taps('down', 3).look(500, 800).taps('up', 3) }),
    'step-fast': () => ({ target: { want: 'any', near: { x: 1, y: 5 } }, perform: (c) => optBackForth(c.begin(), 'down', 'up') }),
    'quick-top': () => ({ target: { want: 'any', near: { x: 1, y: 5 } }, perform: (c) => c.begin().tap('right').look(800, 1200).tap('left') }),
    sort: () => ({ perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300) }),
    delete: () => ({
        target: { want: 'file' },
        attended: 'This deletes the highlighted file from the SD card: put the cursor on a file you do not need, then click Run.',
        perform: (c) => c.begin().chord(['opt'], 'edit').look(900, 1300),
        loops: false,
    }),
    // Previews last as long as the key is held: keep it down 4-5 s (not paced) so the sound is heard.
    'preview-file': (p) => ({
        target: p.screen.id === 'file-browser' ? { want: 'file' } : p.screen.id === 'instrument-pool' ? { zones: zoneByLabel(p.screen, 'Instrument'), want: VALUE } : { want: 'any' },
        perform: (c) => c.begin().tap('play', previewHold(c)).look(600, 900),
    }),
    preview: (p) => ({ instrument: p.screen.id === 'instrument' ? 'filled' : undefined, perform: (c) => c.begin().hold(['edit'], () => c.tap('play', previewHold(c))).look(400, 700) }),
    exit: () => ({ perform: (c) => c.begin().tap('opt').look(600, 900), loops: false }),

    'insert-new': () => ({ target: { want: EMPTY }, perform: (c) => c.begin().tap('edit').look(900, 1300).chord(['edit'], 'opt').look(500, 800), restore: 'reload-if-changed' }),
    'insert-unused': () => ({ target: { want: EMPTY }, perform: (c) => c.begin().doubleTap('edit').look(1000, 1400).chord(['edit'], 'opt').look(500, 800), restore: 'reload-if-changed' }),
    'insert-note-off': () => ({ target: { want: EMPTY }, perform: (c) => c.begin().chord(['opt'], 'edit').look(900, 1300).chord(['edit'], 'opt').look(500, 800), restore: 'reload-if-changed' }),
    'create-new-instrument': (p) =>
        p.screen.id === 'table'
            ? { target: { want: 'any', cmd: '^NXT$' }, perform: (c) => c.begin().doubleTap('edit').look(1000, 1400), restore: 'reload' }
            : { target: { want: EMPTY }, perform: (c) => c.begin().doubleTap('edit').look(1000, 1400).chord(['edit'], 'opt').look(500, 800), restore: 'reload-if-changed' },
    'create-new-table': () => ({ target: { want: 'any', cmd: TBL_CMD }, perform: (c) => c.begin().doubleTap('edit').look(1000, 1400), restore: 'reload' }),
    'show-fx-help': () => ({
        target: { want: VALUE, fallback: EMPTY },
        // Edit+Up opens the help on the current command; releasing Edit without moving puts the same command
        // back. (Browsing is not safe: the list clamps at its edges, so going right then left can land elsewhere.)
        perform: (c) => c.begin().hold(['edit'], () => c.tap('up').look(1400, 1900)).look(500, 800),
        restore: 'reload-if-changed',
    }),

    'enter-selection': (p) => ({
        target: { want: VALUE, room: { down: 2 } },
        perform: (c) => enterSelection(c.begin(), 2, NAV_KIND[p.screen.id] === 'grid' ? 1 : 0).look(900, 1300),
    }),
    'copy-value': (p) => ({
        target: { want: VALUE, room: { down: 2 } },
        perform: (c) => copyAndReturn(enterSelection(c.begin(), 2, NAV_KIND[p.screen.id] === 'grid' ? 1 : 0).look(500, 800), 2),
    }),
    cut: () => ({ target: { want: VALUE, room: { down: 1 } }, perform: (c) => enterSelection(c.begin(), 1).think().chord(['edit'], 'opt').look(900, 1300), restore: 'reload' }),
    'paste-value': pasteSpec,
    copy: (p) => ({
        instrument: p.screen.id === 'instrument' ? 'filled' : undefined,
        target: p.screen.id === 'instrument-pool' ? { zones: zoneByLabel(p.screen, 'Instrument'), want: VALUE } : { want: 'any' },
        perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300),
    }),
    // Phrase: the instrument column (cloning an FX value only works after TBL/TBX/GRV/GGR); Table: those commands.
    clone: (p) => ({
        target: p.screen.id === 'table' ? { want: 'any', cmd: TBL_CMD } : p.screen.id === 'phrase' ? { want: VALUE, zones: p.zones.filter((z) => z.label === 'Instrument') } : { want: VALUE },
        perform: (c) => c.begin().hold(['shift'], () => c.tap('opt').move().tap('edit')).look(1000, 1400),
        restore: 'reload',
    }),
    'deep-clone': () => ({ target: { want: VALUE }, perform: (c) => c.begin().hold(['shift'], () => c.tap('opt').move().doubleTap('edit')).look(1000, 1400), restore: 'reload' }),
    'move-selection': () => ({ target: { want: VALUE, room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 1).think().hold(['edit'], () => c.taps('down', 2).look(500, 800).taps('up', 2)).look(400, 700), restore: 'reload-if-changed' }),
    'shift-selection': () => ({ target: { want: VALUE, room: { down: 4 } }, perform: (c) => enterSelection(c.begin(), 2).think().hold(['edit'], () => c.taps('down', 2).look(500, 800).taps('up', 2)).look(400, 700), restore: 'reload-if-changed' }),
    'edit-multiple': () => ({ target: { want: VALUE, room: { down: 1 }, pairDown: 1 }, perform: (c) => enterSelection(c.begin(), 1).think().hold(['edit'], () => c.taps('right', 2).look(500, 800).taps('left', 2)).look(400, 700), restore: 'reload-if-changed' }),
    'edit-multiple-quick': () => ({ target: { want: VALUE, room: { down: 1 }, pairDown: 1 }, perform: (c) => enterSelection(c.begin(), 1).think().hold(['edit'], () => c.taps('up', 2).look(500, 800).taps('down', 2)).look(400, 700), restore: 'reload-if-changed' }),
    // A column of values with a value 4 rows below: the selection's ends are what gets interpolated.
    interpolate: (p) => ({
        target: { want: VALUE, zones: [VALUE_COLUMN[p.screen.id]], room: { down: 4 }, pairDown: 4 },
        perform: (c) => enterSelection(c.begin(), 4).think().chord(['shift'], 'edit').look(1000, 1400),
        restore: 'reload-if-changed',
    }),
    'fill-notes': () => ({ target: { want: 'any', room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 3).think().hold(['opt'], () => c.tap('left').look(500, 800).tap('left').look(500, 800).tap('left')).look(800, 1100), restore: 'reload' }),
    'randomize-notes': () => ({ target: { want: 'note', room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 3).think().hold(['opt'], () => c.taps('up', 2).look(500, 800).tap('down')).look(800, 1100), restore: 'reload' }),
    'randomize-pattern': () => ({ target: { want: 'any', room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 3).think().hold(['opt'], () => c.tap('right').look(600, 900).tap('right')).look(800, 1100), restore: 'reload' }),
    loop: () => ({ target: { want: VALUE, room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 3).think().tap('play').look(2000, 2600).tap('play').look(400, 700) }),
    'loop-selection-tracks': () => ({ target: { want: VALUE, room: { down: 3 } }, perform: (c) => enterSelection(c.begin(), 3).think().chord(['shift'], 'play').look(2000, 2600).tap('play').look(400, 700) }),
    'render-selection': () => ({
        target: { want: VALUE, room: { down: 1 } },
        // Double-tap Edit opens the render dialog; Option cancels it, so nothing is rendered.
        perform: (c) => enterSelection(c.begin(), 1).think().doubleTap('edit').look(1500, 2000).tap('opt').look(500, 700),
        review: true,
    }),
    'move-track': (p) => ({
        target: { zones: p.zones, want: VALUE, near: { x: 10, y: 6 } },
        // Up twice on row 00 enters track reordering; move the track right and back, Down leaves.
        perform: (c) => c.begin().doubleTap('up').look(600, 900).hold(['edit'], () => c.tap('right').look(500, 800).tap('left')).look(400, 700).tap('down'),
        restore: 'reload-if-changed',
    }),
    'move-fast': () => ({ target: { want: VALUE, near: { x: 10, y: 8 } }, perform: (c) => optBackForth(c.begin(), 'down', 'up') }),

    // The Chain view shows the chain under the Song cursor, the Phrase view the phrase under the Chain cursor:
    // start on song row 03 and chain row 0, so two steps down and back stay inside the song and the chain.
    'navigate-chain': () => ({ presets: [{ view: 'song', cell: [4, 9] }], perform: (c) => optBackForth(c.begin(), 'down', 'up') }),
    'navigate-phrase': () => ({ presets: [{ view: 'song', cell: [4, 9] }, { view: 'chain', cell: [3, 6] }], perform: (c) => optBackForth(c.begin(), 'down', 'up') }),
    'navigate-track': () => ({ perform: (c) => optBackForth(c.begin(), 'right', 'left') }),
    'next-table': () => ({ perform: (c) => optBackForth(c.begin(), 'right', 'left') }),
    'quick-next-table': () => ({ perform: (c) => optBackForth(c.begin(), 'up', 'down') }),
    'next-entry': () => ({ perform: (c) => optBackForth(c.begin(), 'right', 'left') }),
    'next-quick-entry': (p) => ({
        // Scale: Opt+Up shows the last scale, Opt+Down the first one (checked on the device; start on scale 00 so
        // it loops). Groove: +/- 16 grooves.
        perform: (c) => (p.screen.id === 'scale' ? c.begin().chord(['opt'], 'up').look(900, 1300).chord(['opt'], 'down') : optBackForth(c.begin(), 'up', 'down')),
    }),
    // The cursor starts on TYPE (Instrument) or the first slot (Instrument Pool): paging lands on instruments of
    // other types, whose parameter rows differ, and the pool's first/last page puts the cursor on the first slot.
    'next-instrument': (p) => ({
        instrument: p.screen.id === 'instrument' ? 'filled' : undefined,
        target: pagingStart(p),
        // Instrument Pool: last page, then back to the first one.
        perform: (c) => (p.screen.id === 'instrument-pool' ? c.begin().chord(['opt'], 'right').look(900, 1300).chord(['opt'], 'left') : optBackForth(c.begin(), 'right', 'left')),
    }),
    'next-instrument-quick': (p) => ({ target: pagingStart(p), perform: (c) => (p.screen.id === 'instrument-pool' ? optBackForth(c.begin(), 'down', 'up') : optBackForth(c.begin(), 'up', 'down')) }),

    'undo-paste': instrumentPasteSpec,
    randomize: () => ({
        instrument: 'filled',
        // All four directions held one after the other, then Edit (as in the hand-recorded clip).
        perform: (c) => c.begin().down('down').wait(c.between(90, 160)).down('left').wait(c.between(90, 160)).down('up').wait(c.between(90, 160)).down('right').wait(c.between(150, 250)).tap('edit').wait(c.between(100, 180)).up('right').up('up').up('left').up('down').look(1000, 1400),
        restore: 'reload',
        loops: false,
    }),
    'fm-change-algo': () => ({ instrument: 'FMSYNTH', target: { want: VALUE }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal', restore: 'reload-if-changed' }),
    'fm-change-operator': () => ({ instrument: 'FMSYNTH', target: { want: VALUE }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal', restore: 'reload-if-changed' }),
    'fm-copy-operator': () => ({ instrument: 'FMSYNTH', target: { want: VALUE, near: { x: 9, y: 11 } }, perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300) }),
    'fm-paste-operator': () => ({
        instrument: 'FMSYNTH',
        target: { want: VALUE, near: { x: 9, y: 11 } },
        // Copy operator A, walk to operator B, paste, walk back.
        perform: (c) => c.begin().chord(['shift'], 'opt').look(500, 800).taps('right', 2).look(400, 600).chord(['shift'], 'edit').look(900, 1300).taps('left', 2),
        restore: 'reload',
    }),
    'hyper-add-note': () => ({ instrument: 'HYPERSYN', target: { want: EMPTY, fallback: VALUE }, perform: (c) => c.begin().hold(['edit'], () => c.taps('up', 2)).look(900, 1200).chord(['opt'], 'edit').look(500, 800), restore: 'reload-if-changed' }),
    'hyper-change-chord': () => ({ instrument: 'HYPERSYN', target: { want: VALUE }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal', restore: 'reload-if-changed' }),
    'hyper-copy-chord': () => ({ instrument: 'HYPERSYN', target: { want: VALUE, near: { x: 9, y: 10 } }, perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300) }),
    'hyper-paste-value': () => ({
        instrument: 'HYPERSYN',
        target: { want: VALUE, near: { x: 9, y: 10 } },
        // Copy chord bank 00, step to bank 01, paste it there, step back.
        perform: (c) => c.begin().chord(['shift'], 'opt').look(500, 800).chord(['edit'], 'right').look(700, 1000).chord(['shift'], 'edit').look(900, 1300).chord(['edit'], 'left'),
        restore: 'reload',
    }),
    'hyper-remove-note': () => ({ instrument: 'HYPERSYN', target: { want: VALUE }, perform: (c) => c.begin().chord(['opt'], 'edit').look(900, 1300), restore: 'reload', loops: false }),
    'assign-eq': () => ({ instrument: 'filled', target: { want: 'any' }, perform: (c) => c.begin().tap('edit').look(1300, 1800).tap('opt').look(400, 700), restore: 'reload-if-changed' }),

    'move-small': () => ({ target: { want: 'any', near: { x: 14, y: 14 } }, perform: (c) => editBackForth(c.begin(), 'right', 'left'), mirror: 'horizontal' }),
    'move-large': () => ({ target: { want: 'any', near: { x: 14, y: 14 } }, perform: (c) => editBackForth(c.begin(), 'up', 'down'), mirror: 'vertical' }),
    'move-small-steps': () => ({ target: { want: 'any', near: { x: 14, y: 14 } }, perform: (c) => optBackForth(c.begin(), 'right', 'left') }),
    'move-large-steps': () => ({ target: { want: 'any', near: { x: 14, y: 14 } }, perform: (c) => optBackForth(c.begin(), 'up', 'down') }),
    'lazy-chop': () => ({
        target: { want: 'any' },
        // Play held 4-5 s (the sample previews), Edit tapped three times along it: slice markers at the play head.
        perform: (c) => c.begin().down('play').wait(c.between(900, 1100)).tap('edit').wait(c.between(1000, 1200)).tap('edit').wait(c.between(1000, 1200)).tap('edit').wait(c.between(800, 1000)).up('play').look(500, 800),
        // The runner leaves the Sample Editor without saving ("EXIT WITHOUT SAVING CHANGES?" OK): nothing to reload.
        restore: 'none',
        loops: false,
    }),
    record: () => ({ target: { want: 'any' }, perform: (c) => c.begin().tap('edit').look(2000, 2600).tap('edit').look(500, 800), restore: 'none', loops: false, review: true }),
    'delete-slice': () => ({
        target: { want: 'any' },
        attended: 'The sample needs slice markers (lazy-chop one first if needed). Put the cursor on SLICE MARKER, then click Run.',
        perform: (c) => c.begin().chord(['opt'], 'edit').look(900, 1300),
        restore: 'none',
        loops: false,
    }),
    'enter-mix-scope': () => ({ target: { want: 'any' }, perform: (c) => c.begin().tap('edit').look(1300, 1800).tap('opt').look(300, 500) }),
    'enter-limiter-scope': () => ({ target: { want: 'any', near: { x: 28, y: 18 } }, perform: (c) => c.begin().tap('edit').look(1300, 1800).tap('opt').look(300, 500) }),
    'copy-mod-slot': () => ({ target: { want: VALUE, near: { x: 6, y: 5 } }, perform: (c) => c.begin().chord(['shift'], 'opt').look(900, 1300) }),
    'paste-mod-slot': () => ({
        target: { want: VALUE, near: { x: 6, y: 5 } },
        // Copy modulator 1, step right to modulator 3, paste it there, step back.
        perform: (c) => c.begin().chord(['shift'], 'opt').look(500, 800).tap('right').look(400, 600).chord(['shift'], 'edit').look(900, 1300).tap('left'),
        restore: 'reload',
    }),
    'mute-eq': () => ({ target: { want: 'any' }, perform: (c) => c.begin().doubleTap('edit').look(1200, 1600).doubleTap('edit').look(300, 500) }),
    'delete-mapping': () => ({
        attended: 'Put the cursor on an existing MIDI mapping (one must exist), then click Run.',
        perform: (c) => c.begin().chord(['edit'], 'opt').look(900, 1300),
        restore: 'reload',
        loops: false,
    }),
}

const flatten = (keypress) => keypress.flatMap((t) => (Array.isArray(t) ? t : [t]))
const isNonKeyboard = (template) => flatten(template.keypress ?? []).some((t) => t === 'touch' || t === 'midi')

/**
 * navigate-views: a trip of up to `maxDepth` views from `view` (Shift+arrow each time), every step undone by the
 * opposite key, so the clip can come back the same way. Longer trips read better (a view each step, up to
 * `maxDepth`), straight lines a little better still (Song -> Chain -> Phrase -> Instrument), and a trip that starts
 * by going down is preferred to one that starts by going up. Edges to and from the Mixer (weight 10) are used only
 * when nothing else goes further: its "up" goes back to the last sequencer view (fine, the way back is the reverse
 * anyway). Ambiguous edges (Project down, Mods down) use the first target.
 */
const navigatePath = (view, maxDepth = 4) => {
    if (!graph?.[view]) return []
    const reversible = (from, e) => (graph[e.to] ?? []).some((b) => b.to === from && b.dir === OPPOSITE[e.dir])
    let best = null
    const walk = (at, path, seen) => {
        if (path.length) {
            const straight = path.length > 1 && path.every((s) => s.dir === path[0].dir)
            const score = path.length * 10 + (straight ? 6 : 0) + (path[0].dir === 'down' ? 8 : 0) - path.filter((s) => s.weight > 1).length * 20
            if (!best || score > best.score) best = { score, path }
        }
        if (path.length >= maxDepth) return
        const dirs = new Set()
        for (const e of graph[at] ?? []) {
            if (dirs.has(e.dir)) continue
            dirs.add(e.dir)
            if (seen.has(e.to) || !reversible(at, e)) continue
            walk(e.to, [...path, { dir: e.dir, to: e.to, weight: e.weight ?? 1 }], new Set([...seen, e.to]))
        }
    }
    walk(view, [], new Set([view]))
    return best?.path ?? []
}
// Sub-views: Shift+Up leaves the Project sub-views for the Project view (checked on System Settings); the Mixer and
// Instrument sub-views are entered to the right, so Shift+Left goes back.
const SUBVIEW_DIRECTION = { project: 'up', 'system-settings': 'up', mixer: 'left', instrument: 'left' }

/** Sub-view trip: leave each sub-view level, then go on through the graph so the clip shows three views. */
const subViewPath = (screenId) => {
    const path = []
    let id = screenId
    while (ROUTES[id]) {
        const parent = ROUTES[id].from
        path.push({ dir: SUBVIEW_DIRECTION[parent] ?? 'up', to: YAM8D_VIEW[parent] ?? parent })
        id = parent
    }
    if (path.length < 3) path.push(...navigatePath(YAM8D_VIEW[id], 3 - path.length))
    return path
}

// ---------- jobs ----------

const rngFor = (id) => mulberry32(hashText(`${id}#${seed}`))

/** Plays a gesture; `tailMs` is the look after the last key, which the clip keeps before its post-roll. */
const takeFor = (id, perform) => {
    const c = new Take(rngFor(id))
    perform(c)
    const steps = c.result()
    return { steps, tailMs: Math.max(0, c.t - steps[steps.length - 1][0]) }
}

const reference = (p) => {
    for (const other of placements) {
        if (other === p || other.template.id !== p.template.id || !hasVideo(other) || !hasEvents(other)) continue
        try {
            const events = readJson(mediaPath(other, 'json'))
            if (Array.isArray(events) && events.length) {
                const t0 = events[0][0]
                return { file: `${other.folder}/${other.slug}`, events: events.map(([ms, mask]) => [ms - t0, mask]) }
            }
        } catch { /* empty or half-written file */ }
    }
    return null
}

const jobs = []
for (const p of placements) {
    const id = p.template.id
    const jobId = `${p.folder}/${p.slug}`
    if (onlyScreens.size && !onlyScreens.has(p.screen.id)) continue
    const redoThis = (redoAll && hasVideo(p)) || (redoGenerated && gitNew.has(jobId)) || redo.has(jobId)
    if (hasVideo(p) && !redoThis) continue

    const route = routeFor(p.screen.id)
    const job = {
        id: jobId,
        folder: p.folder,
        slug: p.slug,
        screenId: p.screen.id,
        screenName: p.screen.name,
        activityId: id,
        name: p.name,
        yam8dView: YAM8D_VIEW[p.screen.id] ?? null,
        baseView: baseView(p.screen.id),
        views: VIEWS[p.screen.id] ?? [],
        route,
        cursor: null,
        zone: null,
        zoneLabel: null,
        context: { transport: 'stopped', instrument: null, target: null, seek: null },
        pass: null,
        mode: 'auto',
        source: 'choreography',
        needsReview: false,
        keypress: p.template.keypress ?? [],
        setup: [],
        restore: { kind: 'none' },
        syncCheck: false,
        settle: false,
        mirror: null,
        loops: true,
        recipe: null,
        tailMs: 0,
        take: seed,
        notes: [],
    }
    if (gitNew.has(jobId)) job.recorded = 'new'
    if (redoThis) {
        job.redo = true
        job.notes.push('re-recording: the existing clip is overwritten (tick "Overwrite existing files")')
    }

    if (isNonKeyboard(p.template)) {
        job.source = 'manual'
        job.mode = 'deferred'
        job.notes.push('touch/MIDI gesture: cannot be produced by key presses (D5)')
        const ref = reference(p)
        if (ref) job.reference = ref
        jobs.push(job)
        continue
    }

    const makeSpec = SPECS[id]
    if (!makeSpec) throw new Error(`${jobId}: no choreography for "${id}" (add it to SPECS)`)
    const spec = makeSpec(p)

    // Where the cursor starts: a cell of the zone (or the screen's content area for global shortcuts).
    if (spec.target !== null) {
        const t = spec.target ?? { want: 'any' }
        // The screen's preferred start cell applies when the shortcut covers the whole content area.
        const usesContent = !t.zones?.length && p.workZones === p.screen.defaultZones
        const start = usesContent ? START_CELL[p.screen.id] : undefined
        const startZones = start?.zoneLabels ? start.zoneLabels.flatMap((l) => zoneByLabel(p.screen, l)) : null
        const zones = (t.zones?.length ? t.zones : startZones?.length ? startZones : p.workZones).map(plain)
        const near = t.near ?? start?.near ?? firstCell(zones[0])
        job.context.target = {
            zones,
            want: t.want ?? 'any',
            near,
            ...(t.fallback ?? start?.fallback ? { fallback: t.fallback ?? start.fallback } : {}),
            ...(t.cmd ? { cmd: t.cmd } : {}),
            ...(t.room ? { room: t.room } : {}),
            ...(t.pairDown ? { pairDown: t.pairDown } : {}),
            ...(start?.avoid ? { avoid: start.avoid } : {}),
        }
        job.cursor = near
        job.zone = { x: zones[0].x, y: zones[0].y, w: zones[0].w, h: zones[0].h }
        job.zoneLabel = zones[0].label ?? null
        job.context.seek = SEEK[p.screen.id] ?? null
    }
    if (spec.transport) job.context.transport = spec.transport
    if (spec.transport === 'playing') job.context.play = PLAY_FROM
    if (spec.mute) job.context.mute = spec.mute
    if (spec.presets) job.context.presets = spec.presets
    const instrumentNeeded = spec.instrument ?? (p.screen.id === 'instrument' ? 'filled' : null)
    if (instrumentNeeded) job.context.instrument = instrumentNeeded
    if (spec.setup) job.setup.push(...spec.setup)
    if (spec.attended) {
        job.mode = 'attended'
        job.setup.unshift({ op: 'ask', text: spec.attended })
    }
    if (spec.restore) job.restore = { kind: p.screen.id === 'time-stats' ? 'none' : spec.restore }
    if (spec.mirror) job.mirror = spec.mirror
    if (spec.loops === false) job.loops = false
    if (spec.review) job.needsReview = true
    if (spec.notes) job.notes.push(...spec.notes)
    job.syncCheck = job.restore.kind === 'value'

    if (spec.navigateViews) {
        // Graph views: a trip of two or three views with Shift held, a look at each, then the same way back (the
        // clip loops). Sub-views cannot be re-entered with Shift: the clip leaves and goes on one more view.
        const subView = !job.yam8dView
        const path = subView ? subViewPath(p.screen.id) : navigatePath(job.yam8dView)
        job.path = path.map(({ dir, to }) => ({ dir, to }))
        job.direction = path[0]?.dir ?? 'up'
        const take = takeFor(jobId, (c) => {
            c.begin().hold(['shift'], () => {
                for (const [i, s] of path.entries()) (i ? c.look(600, 900) : c).tap(s.dir)
            })
            c.look(900, 1300)
            if (!subView) {
                const back = [...path].reverse().map((s) => OPPOSITE[s.dir])
                c.hold(['shift'], () => {
                    for (const [i, d] of back.entries()) (i ? c.look(450, 700) : c).tap(d)
                }).look(400, 700)
            }
        })
        job.recipe = take.steps
        job.tailMs = take.tailMs
        const views = [job.yam8dView ?? p.screen.id, ...path.map((s) => s.to)].join(' -> ')
        if (subView) {
            job.loops = false
            job.needsReview = true
            job.notes.push(`sub-view: ${views} (Shift+${path.map((s) => s.dir).join(', Shift+')}); it cannot come back with Shift`)
        } else job.notes.push(`${views} and back (Shift+${path.map((s) => s.dir).join(', ')} then the opposite keys)`)
    } else {
        const take = takeFor(jobId, spec.perform)
        job.recipe = take.steps
        job.tailMs = take.tailMs
    }

    job.pass = job.yam8dView ? 1 : 2
    jobs.push(job)
}

// Calibration clips (plan section 4.1): clips that exist, replayed from their own timeline into _golden/.
for (const [folder, slug] of [['song', 'play'], ['song', 'navigate']]) {
    if (onlyScreens.size && !onlyScreens.has('song')) break
    const p = placements.find((x) => x.folder === folder && x.slug === slug)
    if (!p || !hasEvents(p)) continue
    let events
    try { events = readJson(mediaPath(p, 'json')) } catch { continue }
    const t0 = events[0][0]
    const recipe = events.map(([ms, mask]) => [ms - t0, mask])
    jobs.push({
        id: `_golden/${folder}/${slug}`,
        folder: `_golden/${folder}`,
        slug,
        screenId: p.screen.id,
        screenName: p.screen.name,
        activityId: p.template.id,
        name: `${p.name} (golden test)`,
        yam8dView: YAM8D_VIEW[p.screen.id],
        baseView: YAM8D_VIEW[p.screen.id],
        views: VIEWS[p.screen.id],
        route: routeFor(p.screen.id),
        cursor: centre(p.workZones[0]),
        zone: plain(p.workZones[0]),
        zoneLabel: p.workZones[0].label ?? null,
        context: { transport: 'stopped', instrument: null, target: { zones: p.workZones.map(plain), want: 'any', near: centre(p.workZones[0]) }, seek: null },
        pass: 0,
        mode: 'auto',
        source: 'reference',
        needsReview: true,
        keypress: p.template.keypress ?? [],
        setup: [],
        restore: { kind: 'none' },
        syncCheck: false,
        settle: false,
        mirror: null,
        loops: true,
        golden: { original: `${folder}/${slug}` },
        reference: { file: `${folder}/${slug}`, events: recipe },
        recipe,
        notes: ['compare with the original clip and timeline (plan section 4.1)'],
    })
}

// ---------- validation and listing ----------

for (const job of jobs) {
    const lists = job.recipeByDirection ? Object.values(job.recipeByDirection) : job.recipe ? [job.recipe] : []
    for (const steps of lists) {
        for (let i = 0; i < steps.length; i++) {
            const [t, m] = steps[i]
            if (!Number.isInteger(t) || !Number.isInteger(m) || m < 0 || m > 255 || (i > 0 && t <= steps[i - 1][0])) {
                throw new Error(`${job.id}: invalid recipe step ${JSON.stringify(steps[i])}`)
            }
        }
        if (steps.length && steps[steps.length - 1][1] !== 0) throw new Error(`${job.id}: recipe does not end at mask 0`)
    }
}

const BITS = [['opt', 0x02], ['shift', 0x10], ['edit', 0x01], ['play', 0x08], ['up', 0x40], ['down', 0x20], ['left', 0x80], ['right', 0x04]]
const chordName = (mask) => BITS.filter(([, b]) => mask & b).map(([n]) => n).join('+')
/** "opt+shift opt+shift+play" style summary: the held state each time a key goes down. */
const describe = (steps) => {
    const out = []
    let prev = 0
    for (const [, m] of steps) {
        if (m & ~prev) out.push(chordName(m))
        prev = m
    }
    const runs = []
    for (const c of out) {
        if (runs.length && runs[runs.length - 1][0] === c) runs[runs.length - 1][1]++
        else runs.push([c, 1])
    }
    return runs.map(([c, n]) => (n > 1 ? `${c}x${n}` : c)).join(' ')
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`${pad('job', 40)} ${pad('pass', 4)} ${pad('mode', 9)} ${pad('start', 8)} ${pad('target', 14)} keys`)
for (const j of jobs) {
    const recipe = j.recipeByDirection ? j.recipeByDirection[j.direction] : j.recipe
    const keys = recipe ? `${describe(recipe)}  (${recipe[recipe.length - 1][0]} ms)` : '-'
    const target = j.context.target ? `${j.context.target.want}${j.context.instrument ? `/${j.context.instrument}` : ''}` : j.context.instrument ?? '-'
    console.log(`${pad(j.id, 40)} ${pad(j.pass ?? '-', 4)} ${pad(j.mode, 9)} ${pad(j.context.transport, 8)} ${pad(target, 14)} ${keys}${j.needsReview ? '  [review]' : ''}`)
}
const real = jobs.filter((j) => j.pass !== 0)
const count = (pred) => real.filter(pred).length
console.log(`\n${real.length} jobs (+${jobs.length - real.length} golden): pass 1 ${count((j) => j.pass === 1)}, pass 2 ${count((j) => j.pass === 2)}, attended ${count((j) => j.mode === 'attended')}, deferred ${count((j) => j.mode === 'deferred')}, needs review ${count((j) => j.needsReview)}; ${placements.length} placements in the dataset; take ${seed}`)

if (!listOnly) {
    const output = {
        version: 2,
        generatedFrom: 'public/m8-shortcuts.dataset.json',
        timing: { preRollMs: PRE_ROLL_MS, postRollMs: POST_ROLL_MS, fps: 30, width: 480, height: 320 },
        jobs,
    }
    writeFileSync(outPath, `${JSON.stringify(output, null, 1)}\n`)
    console.log(`Wrote ${outPath} (${jobs.length} jobs)`)
}
