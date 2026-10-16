import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const datasetPath = join(root, 'public', 'm8-shortcuts.dataset.json')

// Proposal A — scope-based levels grounded in the M8 Operation Manual:
// 0 = global (manual "Global Key Shortcuts" — identical in every view)
// 1 = grid-common (manual "Common Editing Shortcuts" — shared by all grid views)
// 2 = view/screen-level (only meaningful in 1-3 views; the default)
// 3 = cell/context (cursor column/zone qualifiers, or selection-mode context)
/** @type {Record<string, 0|1|2|3>} */
const LEVELS = {
  // 0 — global: work identically in every view (manual pp.7-8).
  // Plain-direction navigation is global ([DIRECTION] moves the cursor
  // everywhere); [OPT]+direction jumps are view-local (chain/phrase/
  // table/instrument…), hence L2.
  'navigate-screen': 0,
  'navigate-views': 0,
  'move-slow': 0,
  'step-slow': 0,
  'quick-top': 0,
  'continue-song': 0,
  'mute-track': 0,
  'solo-track': 0,
  'set-default': 0,
  'snapshot-create': 0,
  'snapshot-recall': 0,
  'assign-midi': 0,
  'assign-touch': 0,
  exit: 0,
  play: 0,
  // 1 — grid-common: identical in all grid views (manual p.8)
  'edit-small': 1,
  'edit-large': 1,
  'insert-new': 1,
  'enter-selection': 1,
  'copy-value': 1,
  cut: 1,
  'paste-value': 1,
  copy: 1,
  clone: 1,
  'edit-multiple': 1,
  'edit-multiple-quick': 1,
  'edit-related': 1,
  'move-selection': 1,
  'shift-selection': 1,
  interpolate: 1,
  'clear-all-mute-solo': 1,
  'clear-mutes': 1,
  // 3 — cell/context: cursor-column/zone qualifiers or select-mode context
  'insert-note-off': 3,
  'deep-clone': 3,
  'move-track': 3,
  'render-selection': 3,
  'edit-octave': 3,
  'edit-note': 3,
  'show-fx-help': 3,
  'fill-notes': 3,
  'randomize-notes': 3,
  'randomize-pattern': 3,
  'change-root-key': 3,
  'enable-key': 3,
  'fm-change-algo': 3,
  'fm-change-operator': 3,
  'fm-copy-operator': 3,
  'fm-paste-operator': 3,
  'hyper-add-note': 3,
  'hyper-change-chord': 3,
  'hyper-copy-chord': 3,
  'hyper-paste-value': 3,
  'hyper-remove-note': 3,
  'create-new-instrument': 3,
  'create-new-table': 3,
  'name-instrument': 3,
  'assign-eq': 3,
  'enter-mix-scope': 3,
  'enter-limiter-scope': 3,
  // 2 — view: everything else (default, no entry needed)
}

const raw = readFileSync(datasetPath, 'utf8')
const data = JSON.parse(raw)

let updated = 0
for (const activity of data.activities) {
  const next = /** @type {0|1|2|3} */ (LEVELS[activity.id] ?? 2)
  if (activity.level !== next) {
    activity.level = next
    updated += 1
  }
}

// Level is a property of the shortcut, not the screen: strip per-screen
// overrides so the template scope level is the single source of truth.
let stripped = 0
for (const screen of data.screens) {
  for (const ref of screen.activities) {
    if (typeof ref !== 'string' && 'level' in ref) {
      delete ref.level
      stripped += 1
    }
  }
}

writeFileSync(datasetPath, `${JSON.stringify(data, null, 2)}\n`)

const counts = [0, 0, 0, 0]
for (const activity of data.activities) counts[activity.level] += 1
console.log(`updated ${updated} template levels, stripped ${stripped} screen overrides`)
console.log(`spread: L0=${counts[0]} L1=${counts[1]} L2=${counts[2]} L3=${counts[3]}`)
