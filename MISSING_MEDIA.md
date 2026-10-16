# Missing media — M8 shortcuts

Audit of `public/m8-shortcuts.dataset.json` against `public/assets/activity/`, generated 2026-10-09 from the working tree (includes uncommitted dataset edits).

## How "has media" is decided

A shortcut placed on a screen has media when this video exists:

`public/assets/activity/<media folder>/<media name>.mp4`

- Media folder = the screen's `mediaFolder`, or its `id` if not set.
- Media name = the placement's `media` override, or the shortcut `id` if not set (e.g. Project → `continue-song` uses `continue-play.mp4`).
- Each video has a paired `.json` events file. In every case here the two are missing together, so the tables list only the `.mp4` name.
- Screenshots are not the gap: all 22 screens have their image in `public/assets/screens/`. Shortcuts have no per-shortcut screenshot in this project.

## Summary

- **83 of 312** shortcut placements (27%) across 22 screens have no video. A shortcut listed on several screens counts once per screen, since each screen has its own video.
- **6 shortcuts** have no video on any screen (section 1).
- **8 screens** have no media folder at all (section 2).
- The 2 video pairs that were on disk without a screen reference are now wired in (section 4).

## 1. Shortcuts with no video on any screen

| Shortcut | Name | Placed on screens |
|---|---|---|
| `navigate-views` | Navigate views | `project`, `midi-mappings`, `midi-settings`, `file-browser`, `render-audio`, `song`, `chain`, `phrase`, `table`, `groove`, `scale`, `instrument`, `instrument-pool`, `instrument-mods`, `sample-editor`, `fx-settings`, `mixer`, `scope`, `equalizer-bank`, `system-settings`, `theme`, `time-stats` |
| `delete-mapping` | Delete Mapping | `midi-mappings`, `midi-settings` |
| `stop-track` | Stop Track (Live Mode) | `song` |
| `insert-note-off` | Insert Note-Off | `phrase` |
| `copy-mod-slot` | Copy Modulation Slot | `instrument-mods` |
| `paste-mod-slot` | Paste Modulation Slot | `instrument-mods` |

## 2. Screens with no media folder

Create the folder and record every shortcut below. Nothing exists yet for these screens.

| Screen | Folder to create | Shortcuts missing |
|---|---|---|
| MIDI Mappings (`midi-mappings`) | `public/assets/activity/midi-mappings/` | 5 |
| MIDI Settings (`midi-settings`) | `public/assets/activity/midi-settings/` | 5 |
| Render (`render-audio`) | `public/assets/activity/render-audio/` | 5 |
| Instrument Pool (`instrument-pool`) | `public/assets/activity/instrument-pool/` | 14 |
| Modulators (`instrument-mods`) | `public/assets/activity/instrument-mods/` | 17 |
| System Settings (`system-settings`) | `public/assets/activity/system-settings/` | 4 |
| Theme (`theme`) | `public/assets/activity/theme/` | 5 |
| Time Stats (`time-stats`) | `public/assets/activity/time-stats/` | 4 |

## 3. Missing videos per screen

Expected file is `<folder>/<name>.mp4` (plus `.json`), under `public/assets/activity/`.

### Project — 1 of 14 missing

Folder: `project/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `project/navigate-views.mp4` |

### MIDI Mappings — 5 of 5 missing

Folder: `midi-mappings/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `midi-mappings/navigate-views.mp4` |
| `exit` | Exit | `midi-mappings/exit.mp4` |
| `edit-large` | Edit in large increments | `midi-mappings/edit-large.mp4` |
| `edit-small` | Edit in small increments | `midi-mappings/edit-small.mp4` |
| `delete-mapping` | Delete Mapping | `midi-mappings/delete-mapping.mp4` |

### MIDI Settings — 5 of 5 missing

Folder: `midi-settings/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `midi-settings/navigate-views.mp4` |
| `exit` | Exit | `midi-settings/exit.mp4` |
| `edit-large` | Edit in large increments | `midi-settings/edit-large.mp4` |
| `edit-small` | Edit in small increments | `midi-settings/edit-small.mp4` |
| `delete-mapping` | Delete Mapping | `midi-settings/delete-mapping.mp4` |

### File Browser — 1 of 8 missing

Folder: `fileBrowser/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `fileBrowser/navigate-views.mp4` |

### Render — 5 of 5 missing

Folder: `render-audio/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `render-audio/navigate-views.mp4` |
| `exit` | Exit | `render-audio/exit.mp4` |
| `edit-large` | Edit in large increments | `render-audio/edit-large.mp4` |
| `edit-small` | Edit in small increments | `render-audio/edit-small.mp4` |
| `set-default` | Set default value | `render-audio/set-default.mp4` |

### Song — 3 of 28 missing

Folder: `song/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `song/navigate-views.mp4` |
| `stop-track` | Stop Track (Live Mode) | `song/stop-track.mp4` |
| `insert-unused` | Insert unused Phrase | `song/insert-unused.mp4` |

### Chain — 1 of 20 missing

Folder: `chain/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `chain/navigate-views.mp4` |

### Phrase — 2 of 30 missing

Folder: `phrase/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `phrase/navigate-views.mp4` |
| `insert-note-off` | Insert Note-Off | `phrase/insert-note-off.mp4` |

### Table — 1 of 23 missing

Folder: `table/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `table/navigate-views.mp4` |

### Groove — 1 of 19 missing

Folder: `groove/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `groove/navigate-views.mp4` |

### Scale — 7 of 15 missing

Folder: `scale/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `scale/navigate-views.mp4` |
| `play` | Play | `scale/play.mp4` |
| `continue-song` | Continue song | `scale/continue-play.mp4` |
| `mute-track` | Mute Track | `scale/mute-track.mp4` |
| `solo-track` | Solo Track | `scale/solo-track.mp4` |
| `clear-all-mute-solo` | Clear mutes and solos | `scale/clear-mutes.mp4` |
| `set-default` | Set default value | `scale/set-default.mp4` |

### Instrument — 1 of 31 missing

Folder: `instrument/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `instrument/navigate-views.mp4` |

### Instrument Pool — 14 of 14 missing

Folder: `instrument-pool/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-screen` | Navigate | `instrument-pool/navigate.mp4` |
| `navigate-views` | Navigate views | `instrument-pool/navigate-views.mp4` |
| `next-instrument` | Next / prev instrument | `instrument-pool/next-instrument.mp4` |
| `next-instrument-quick` | Quick next / prev instrument | `instrument-pool/next-instrument-quick.mp4` |
| `continue-song` | Continue song | `instrument-pool/continue-song.mp4` |
| `mute-track` | Mute Track | `instrument-pool/mute-track.mp4` |
| `solo-track` | Solo Track | `instrument-pool/solo-track.mp4` |
| `clear-mutes` | Clear mutes and solos | `instrument-pool/clear-mutes.mp4` |
| `edit-large` | Edit in large increments | `instrument-pool/edit-large.mp4` |
| `edit-small` | Edit in small increments | `instrument-pool/edit-small.mp4` |
| `set-default` | Set default value | `instrument-pool/set-default.mp4` |
| `copy` | Copy | `instrument-pool/copy.mp4` |
| `paste-value` | Paste | `instrument-pool/paste-value.mp4` |
| `preview-file` | Preview | `instrument-pool/preview-file.mp4` |

### Modulators — 17 of 17 missing

Folder: `instrument-mods/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `instrument-mods/navigate-views.mp4` |
| `next-instrument` | Next / prev instrument | `instrument-mods/next-instrument.mp4` |
| `next-instrument-quick` | Quick next / prev instrument | `instrument-mods/next-instrument-quick.mp4` |
| `play` | Play | `instrument-mods/play.mp4` |
| `continue-song` | Continue song | `instrument-mods/continue-track.mp4` |
| `mute-track` | Mute Track | `instrument-mods/mute-track.mp4` |
| `solo-track` | Solo Track | `instrument-mods/solo-track.mp4` |
| `clear-mutes` | Clear mutes and solos | `instrument-mods/clear-mutes.mp4` |
| `edit-large` | Edit in large increments | `instrument-mods/edit-large.mp4` |
| `edit-small` | Edit in small increments | `instrument-mods/edit-small.mp4` |
| `edit-touch` | Edit with touchscreen | `instrument-mods/edit-touch.mp4` |
| `set-default` | Set default value | `instrument-mods/set-default.mp4` |
| `copy-mod-slot` | Copy Modulation Slot | `instrument-mods/copy-mod-slot.mp4` |
| `paste-mod-slot` | Paste Modulation Slot | `instrument-mods/paste-mod-slot.mp4` |
| `preview` | Preview Instrument | `instrument-mods/preview.mp4` |
| `assign-midi` | Assign MIDI CC to Parameter | `instrument-mods/assign-midi.mp4` |
| `assign-touch` | Assign Touch-Axis as MIDI to Parameter | `instrument-mods/assign-touch.mp4` |

### Sample Editor — 2 of 11 missing

Folder: `sample-editor/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `sample-editor/navigate-views.mp4` |
| `set-default` | Set default value | `sample-editor/set-default.mp4` |

### FX Settings — 1 of 11 missing

Folder: `fx/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `fx/navigate-views.mp4` |

### Mixer — 1 of 15 missing

Folder: `mixer/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `mixer/navigate-views.mp4` |

### Limiter & Mix Scope — 1 of 12 missing

Folder: `scope/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `scope/navigate-views.mp4` |

### Equalizer — 1 of 14 missing

Folder: `eq/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `eq/navigate-views.mp4` |

### System Settings — 4 of 4 missing

Folder: `system-settings/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `system-settings/navigate-views.mp4` |
| `edit-large` | Edit in large increments | `system-settings/edit-large.mp4` |
| `edit-small` | Edit in small increments | `system-settings/edit-small.mp4` |
| `set-default` | Set default value | `system-settings/set-default.mp4` |

### Theme — 5 of 5 missing

Folder: `theme/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `theme/navigate-views.mp4` |
| `exit` | Exit | `theme/exit.mp4` |
| `edit-large` | Edit in large increments | `theme/edit-large.mp4` |
| `edit-small` | Edit in small increments | `theme/edit-small.mp4` |
| `set-default` | Set default value | `theme/set-default.mp4` |

### Time Stats — 4 of 4 missing

Folder: `time-stats/`

| Shortcut | Name | Expected file |
|---|---|---|
| `navigate-views` | Navigate views | `time-stats/navigate-views.mp4` |
| `exit` | Exit | `time-stats/exit.mp4` |
| `edit-large` | Edit in large increments | `time-stats/edit-large.mp4` |
| `edit-small` | Edit in small increments | `time-stats/edit-small.mp4` |

## 4. Media on disk but not referenced by any screen

None. `table/edit-note` and `eq/navigate` were wired into the dataset (Table lists `edit-note`, Equalizer lists `navigate-screen` with media `navigate`).
