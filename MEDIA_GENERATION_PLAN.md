# Plan: generate the missing shortcut media with yam8d

Goal: for each of the 83 missing placements listed in `MISSING_MEDIA.md`, produce
`public/assets/activity/<folder>/<slug>.mp4` (the looping screen video) and
`public/assets/activity/<folder>/<slug>.json` (the synchronised keypress timeline),
recorded from a real M8 through the running yam8d at `http://localhost:5173/`.

Status: the job builder and the runner page are written and were smoke-tested against a mock host in headless Chrome (section 11). Not yet run against the real M8. Decisions D1–D8 are answered (section 9).

---

## 1. What the code already gives us

These facts were checked in the source, not assumed.

| Need | What exists | Where |
|---|---|---|
| Timeline format | `[ms, mask]` pairs. Each mask is the full held-key state until the next entry. Bits: Left `0x80`, Up `0x40`, Down `0x20`, Shift `0x10`, Play `0x08`, Right `0x04`, Opt `0x02`, Edit `0x01`. Identical in yam8d and in the m8-shortcuts player. | `yam8d/src/features/connection/keys.ts:1-9`, `m8-shortcuts/src/features/M8Player.tsx:131-138` |
| Every key source reaches the device through one call | Keyboard, gamepad, on-screen body, macros, virtual keyboard and the SDK all end in `connection.commands.sendKeys(mask)`. | `useM8input.ts:57`, `macroRunner.ts:51,78`, `useViewNavigator.ts:191`, `sdk/host/hostIO.ts` |
| Keys are queued and sent one per tick | `sendKeys` only pushes to a queue. `frameCheck` writes one queued command every `waitTime = 20 ms`. | `connection.ts:8`, `connection.ts:58-61` (serial/USB), `connection.ts:15-18` (MIDI) |
| SDK methods that work without a postMessage hop | `createHostMethods` is transport-agnostic. It provides `navigateToView`, `navigateTo`, `setValue*`, `sendKeyDown/Up`, `getState`, `getScreen`. It is built inside `useM8SdkHost`. | `sdk/host/hostMethods.ts:32`, `sdk/useM8SdkHost.ts:145` |
| Canvas recorder | `captureStream(frameRate)` plus `MediaRecorder`, with a WebM output (VP9/VP8 + Opus) and a WebM duration fix. | `recording/useCanvasRecorder.ts:30,191,283`, `recording/fixWebmDuration.ts` |
| Recorder start time is not the video t0 | `startTimeRef = Date.now()` is set before the streams exist. The runner uses its own recorder and `recorder.onstart` instead. | `useCanvasRecorder.ts:181` |
| Screen canvas size is not fixed | The canvas backing store is CSS size × `devicePixelRatio`, so it is not 480×320 by default. | `rendering/M8Screen.tsx:200-213` |
| Screen canvas is a placeholder | When `OffscreenCanvas` is available, the DOM canvas is handed to a worker with `transferControlToOffscreen`. The page only holds a placeholder, so `drawImage` from it is not guaranteed to return pixels. | `M8Screen.tsx:19-21,58`, `M8Player.tsx:285` |
| Transport choice | `connect()` uses Web Serial when available, then WebUSB, then MIDI. In Chrome/Edge the serial path is the one in use. | `connection.ts:433` |
| SDK host methods are reachable from an external app iframe | `createHostMethods` is built when an External Apps iframe loads (`useM8SdkHost` is used only by `ExternalAppsDisplay`). A built-in test app, `sdk-test.html` ("M8 SDK Test"), is served from yam8d's `public/` on the same origin, and already has Send Key and logs `keyPressed` events. The runner uses that route. | `useM8SdkHost.ts:116-152`, `ExternalAppsDisplay.tsx:86`, `externalAppsConfig.ts:5,25`, `public/sdk-test.html:962,1204` |
| Existing assets | 480×320 H.264 (`avc1`) + Opus, **fragmented** MP4 (`moof` boxes, no usable header duration). That is what Chrome's `MediaRecorder` writes, so direct MP4 recording is plausible. The player is muted, so the audio track is not used. | MP4 headers of `song/play`, `instrument/paste`, `phrase/edit-note`, `eq/navigate` |
| Existing timelines (reference) | 229 JSON files, paired with 229 MP4. All parse, all are time-sorted, all end at mask `0`. | `m8-shortcuts/public/assets/activity/**` |
| Typical human timing in those timelines | First press at p50 701 ms (p10 340, p90 1103). Hold per key p50 108 ms (p10 78; p90 832 because held modifiers count). Release gap p50 176 ms. | same, recomputed over all 229 files |
| Dataset keypress recipes | Each shortcut has a `keypress` grammar (`shift-hold`, `or`, `2x`, `3x-not-first`, `after`, …) and some have prerequisite states (`select-mode`). | `m8-shortcuts/public/m8-shortcuts.dataset.json` |

Two things are not in the code and have to be built or checked on hardware:

- **No simulator.** The screen only exists when a real M8 is connected over WebSerial/WebUSB. Without the device there is no video.
- **The M8 may echo key state back.** `protocol.ts:220` emits a `key` event from device messages, and the host forwards it to the iframe as `keyPressed` (`useM8SdkHost.ts:295-301`). Whether the M8 reports the keys it received is not verified. It can be tested now with no new code: open "M8 SDK Test", use Send Key, and watch the `keyPressed` log. If it echoes, it is a second, device-side clock for the timeline.

## 2. Scope

- 83 jobs, one per unique file, because no two placements share a `<folder>/<slug>` pair.
- 50 placements are on the 12 screens that the view graph can navigate to automatically (`m8Graph.generated.json`). Three of them are touch/MIDI and are deferred (D5), so **pass 1 is 47 jobs**: 31 with a reference timeline and 16 compiled.
- 33 placements are on 10 screens that have no graph node: MIDI Mappings, MIDI Settings, File Browser, Render, Sample Editor, Limiter/Mix Scope, Equalizer Bank, System Settings, Theme, Time Stats. They need a manual navigation step and are deferred to **pass 2** (D6), together with the 3 touch/MIDI placements (36 in all). Pass 2 has 12 compiled jobs (10 `navigate-views`, 2 `delete-mapping`) and 21 with a reference.
- 80 placements are keyboard recipes. 2 are touch (`edit-touch`, `assign-touch`) and 1 is MIDI (`assign-midi`), all on Modulators. They cannot be produced by key presses and are deferred (D5).
- 55 placements have a reference timeline: the same shortcut recorded on another screen. The key sequence can be copied from it.
- 28 placements have no reference: `navigate-views` (22 placements), `delete-mapping` (2), `stop-track`, `insert-note-off`, `copy-mod-slot`, `paste-mod-slot` (1 each). Their recipes come from the `keypress` grammar and need manual checking.
- 1 placement needs Select Mode first: `instrument-pool/paste-value`. Its description says it pastes "when there are values in the clipboard", so a copy must also be done in setup.
- 4 more placements need prior state that the dataset does not encode as a prerequisite: `song/stop-track` (Live Mode, a track playing or cued), `phrase/insert-note-off` (cursor on an empty `---` note cell), `instrument-mods/paste-mod-slot` (a slot copied first), `midi-*/delete-mapping` (a mapping exists, pass 2).
- The orphan media pairs `table/edit-note` and `eq/navigate` are now wired into the dataset (D8, done), which makes it 312 placements with the same 83 missing.

## 3. Architecture

Nothing in the yam8d source has to change for the first version. The runner is an **external app**: a static page in the same folder as the built-in `sdk-test.html`, loaded in the External Apps iframe. It drives the M8 through the existing SDK client (`@yam8d/m8-sdk`, the same way `sdk-test.html` does), so it needs no hoisting of the host methods. The page is served by the same origin as yam8d, so it can also read `window.parent` to reach the screen canvas.

```
m8-shortcuts                                   yam8d :5173 -> External Apps -> iframe
------------                                   ---------------------------------------
scripts/build-media-jobs.mjs                    public/media-capture.html (new, same origin)
  dataset -> scripts/media-jobs.json  ----->      pick the m8-shortcuts folder once
                                                  (File System Access): reads jobs, writes assets
                                                  |
                                                  +-- setup via M8Client (postMessage SDK)
                                                  |     navigateToView / navigateTo
                                                  |     captureSnapshot (state + screen text)
                                                  |
                                                  +-- record
                                                  |     sendKeyDown(mask) / sendKeyUp()
                                                  |     -> timeline [ms, mask] (performance.now())
                                                  |     parent canvas.captureStream() -> hidden <video>
                                                  |     -> output canvas, one frame per screen frame (60 fps) -> MediaRecorder (no audio)
                                                  |
                                                  +-- QA gates, then write files
                                                        public/assets/activity/<folder>/<slug>.{mp4,json}
```

The page is selected like any other external app: add an entry with URL `media-capture.html` in the External Apps settings (or pick "M8 SDK Test" for the first experiments, see section 4). It only exists when someone opens it, so production behaviour is unchanged.

### 3.1 What the runner page contains

1. **SDK client**: copy the `importmap` and `createM8Client` import from `sdk-test.html` (lines 7 and 853-855), then call `createM8Client()`, then `navigateToView`, `navigateTo(gridX, gridY)`, `getState`, `getScreen`, `captureSnapshot`, `sendKeyDown(keys)`, `sendKeyUp()`, `onKeyPress`. `sendKeyDown` sets the full held-key state, so a chord change is one call, which matches the timeline format. All methods return a fallback when no M8 is connected, so the page checks `getState()` first. Use `captureSnapshot()` whenever both the state and the screen text are needed: it fetches them together, so they are consistent with each other, and returns the state fields the runner uses (`viewName`, `viewTitle`, `cursorPos`, `selectionMode`, `textUnderCursor`, `currentLine`, `deviceModel`), the 24 screen text rows in `screen.lines`, and a parsed `semantic` context with a text `description` of the active field. Its `capturedAt` is `Date.now()`, a different clock from the `performance.now()` used for the timeline, so it is for before/after comparison only, never for timing.
2. **Key timeline** (`keyTimeline.ts`): log `performance.now()` at each `sendKeyDown/Up` call. Those calls go through postMessage and then the 20 ms send queue (`connection.ts:8,58`), so the real device time is the call time plus 0 to about 20 ms (plus any queue backlog from back-to-back calls). That is under one video frame at 30 fps (33 ms) and constant enough to calibrate (section 4). If the M8 echoes key state (`keyPressed`, see section 1), the echo times give a device-side check.
3. **Screen source** (`captureCanvas.ts`): the screen canvas is an `OffscreenCanvas` placeholder (section 1), so do not `drawImage` from the element. Call `parent.document.querySelector(...).captureStream()`, play the stream into a hidden `<video>`, and `drawImage(video)` onto a 480×320 canvas at 30 fps. That is the same source the existing recorder captures successfully, and it makes the output size independent of window size and DPR. If the screen canvas cannot be found by selector, add a `data-m8-screen` attribute to it (one line in `M8Screen.tsx`).
4. **Recorder**: its own small `MediaRecorder` on the 480×320 canvas stream, with no audio. This avoids touching `useCanvasRecorder.ts`, which assumes WebM (`MIME_TYPES`, `fixWebmDuration`, the `.webm` name), asks for audio unconditionally and sets 12 Mbps. Use a bitrate near the existing clips (about 100 KB to 1.4 MB each). `t0` is the `performance.now()` at which the runner sends the first frame to the recorder, not `recorder.onstart` (changed after testing, section 11): both run in the iframe, so it is the same clock as the timeline.
5. **File sink** (`fileSink.ts`): `showDirectoryPicker()` once on the m8-shortcuts folder, to read `scripts/media-jobs.json` and write `public/assets/activity/**` and `_rejects/`. It must be started from a user click.
6. **Job runner and panel**: the loop in 3.5 and 3.6, with a status table and an **attended mode** (3.5). In attended mode the runner shows where the M8 must be, waits for the user to navigate there, and only starts when the user clicks **Run**.

If calibration (section 4) shows the SDK-level timestamps are too coarse, add one optional dev-only change in yam8d: a key tap in `connection.ts` that records `performance.now()` right before `writer(command)` (line 61), and expose it to the page. Serial/USB sends `[0x43, mask]`; the MIDI path would need the SysEx decode (`0x43` at byte 7, low 7 bits at byte 8, Left in bit 2 of byte 5), but Chrome uses serial first, so it is not needed in practice.

Files in yam8d with staged, uncommitted changes (`vite.config.ts`, `package.json`, `biome.json`, `bun.lock`, `tsconfig.app.json`, `wyw-in-js.config.cjs`, `ShaderCodeEditor.tsx`) are not touched. The only new yam8d file is `public/media-capture.html`.

### 3.2 Video format

- Source: the copy canvas (960×640 or 1920×1280 per the Output size setting), one frame per screen frame, 60 fps at most.
- Codec: H.264 MP4 if Chrome reports `video/mp4;codecs=avc1` (video only) as supported. Verify at runtime first. Otherwise record WebM and transcode with ffmpeg. Chrome's MP4 output is fragmented, like the existing assets, so the header carries no duration. The page checks duration by loading the file in a `<video>` element; the final audit uses `ffprobe` (section 4).
- No audio track (decision D3).
- Length: 600 ms pre-roll, the recipe, then 600 ms post-roll. The aim is that the clip ends on the same view and cursor it started on, so the loop does not jump. The player loops the video and the timeline together. Many shortcuts change a value, so see the restore rule in 3.6.

### 3.3 Timeline format

- `[[ms, mask], ...]` relative to the recorder's `t0`, with `ms` as an integer.
- One entry per change of held-key state. The last entry is always mask `0`.
- Times come from the `sendKeyDown/Up` calls the runner actually made (logged with `performance.now()`), not from the recipe. The recipe is only the plan.

### 3.4 Recipes

Build `scripts/media-jobs.json` once, from the dataset. Each job has: `folder`, `slug`, `screenId`, `yam8dView` (or null), `cursor` (zone centre), `setup` steps, `recipe`, `source`, and `needsReview`.

Recipe source, in priority order:

1. **Reference**: the same shortcut's timeline from another screen. Copy the masks and the relative timing. 55 placements.
2. **Compiled**: derive the presses from the `keypress` grammar, using the default timing from section 1 (tap 108 ms, gap 176 ms, pre-roll 600 ms). 28 placements (16 in pass 1). Every one is marked `needsReview: true`. `or` cannot simply take the first option, because the first option is often not valid on the screen:
   - `navigate-views` (22; 12 in pass 1): the first option is Shift+Up, but the view graph has no up edge from `project`, `scale`, `instrumentpool`, and no down edge from `effectsettings`. The direction comes from the minimap in the bottom-right corner of the M8 screen, which shows which of Shift+Up/Down/Left/Right lead somewhere (D7). The job builder pre-fills a direction from `m8Graph.generated.json` for the 12 pass-1 screens (for `fx`: Shift+Up, then Shift+Down) and leaves it empty for the 10 non-graph screens. The recorded sequence is that key, then the opposite key to come back. These jobs run in attended mode: the user navigates to the screen, can change the direction with four buttons, and clicks Run. The minimap is drawn as text, so the runner reads it from `captureSnapshot().screen.lines` (see "Minimap" below). `getState().minimapKey` is not usable: yam8d declares the atom but nothing sets it, so it is always null.
   - `delete-mapping`, `stop-track`, `insert-note-off`, `copy-mod-slot`, `paste-mod-slot` have no `or`, so the grammar compiles directly (for example `delete-mapping` is Edit held, then Opt).
3. **Manual**: touch and MIDI placements (3). Deferred unless D5 says otherwise.

### 3.5 Setup per job

Each job has a mode. **Auto** jobs are navigated by the runner. **Attended** jobs are navigated by the user: all pass-2 jobs (D6) and all `navigate-views` jobs (D7).

1. Confirm there is no held input: call `sendKeyUp()` and check the macro status is idle.
2. Navigate.
   - Auto: if `yam8dView` is set, call `navigateToView`. Then call `navigateTo` for the cursor cell. Verify with `getState()`: the view name and cursor position must match. Retry up to 3 times, and if it still fails switch that job to attended.
   - Attended: show a banner such as "Go to Render, cursor on the Rate field, then click Run". Show the zone to put the cursor on and, for `navigate-views`, the parsed minimap with the four direction buttons, enabled only for the directions the minimap shows a neighbour in. Poll `captureSnapshot()` and show whether the view name already matches, but do not block on it, because non-graph screens may report a different view name. Wait for the Run click. Do nothing to the M8 until then.
3. On Run, take a `captureSnapshot()`: the M8 must be connected, `deviceModel` must be the expected one, and no macro may be running. For auto jobs the view and cursor must still match. For attended jobs the view name and cursor position are stored as the loop-check baseline (3.6). If the view differs from the expected name, ask for a second click to confirm.
4. Prerequisite state, done before recording and checked with `getState()`:
   - Select Mode (`instrument-pool/paste-value`): press Shift+Opt and check `selectionMode`. Then copy something first (Shift+Opt on a selection, as in `instrument-pool/copy`), so the clipboard is not empty.
   - `instrument-mods/paste-mod-slot`: run `copy-mod-slot` on a filled slot first, then move to the target slot.
   - `song/stop-track`: switch to Live Mode and queue a track so something is playing or cued.
   - `phrase/insert-note-off`: put the cursor on an empty `---` note cell.
5. Nothing is recorded during setup. Recording starts only after setup passes.

#### Minimap

The minimap in the bottom-right corner is plain text, so it is part of `screen.lines`. On the Project view it is three rows:

```
P
SCPIT
V
```

Each letter is a view (here Project above Song, then Song, Chain, Phrase, Instrument, Table, with the Mixer below Song). That matches the graph edges `song -> project` (up) and `song -> mixer` (down). The highlighted letter is the current view, but the highlight is a colour and does not appear in the text, so the current view comes from `viewName`/`viewTitle`.

- Parse: find the letter block in the last rows and rightmost columns of `screen.lines` (it sits at roughly columns 33–38 and rows 19–21 on this layout; fix the exact box in the dry run from a real snapshot). Keep each letter with its (column, row).
- Neighbours: Shift+Up, Down, Left and Right lead to the letter directly above, below, left and right of the current one. The runner enables only those directions.
- Cross-check: for the 12 pass-1 screens the parsed neighbours must agree with `m8Graph.generated.json`. A mismatch is reported in the dry run, not guessed.
- The letter-to-view mapping (P, S, C, P, I, T, V, and the letters other screens use) is built from observed snapshots, because the letters are ambiguous (`P` is both Project and Phrase). Position, not the letter alone, identifies the cell.
- Fallback if the parse fails on a screen (for example it shows no minimap): the runner shows the live screen text and lets the user choose a direction by hand.

### 3.6 Recording and QA per job

- Start the recorder, take `t0` from `onStarted`, wait 600 ms, then run the recipe. Timers are scheduled against `t0`. The runner logs each key call as it is made.
- Stop after the post-roll.
- **Restore, after the recording stops (not recorded)**: many recipes change the project (`set-default`, `delete-mapping`, `mute-track`, `paste-*`, `insert-*`, `edit-*`). Before the next job, put the value back. Save the baseline `captureSnapshot()` (screen text, `textUnderCursor`, cursor) at setup, then restore with the SDK editors (`setValueToInt`, `setValueToString`, …) or, for destructive ones (`delete-mapping`, paste, insert), reload the demo project: `navigateToView('project')`, `navigateTo(14, 14)` (the Load action), press Edit, then `browseFile('LAAMAA_SNOWYDAY')`. The runner checks `getState().viewName` after the reload. Key presses alone cannot undo `set-default`.
- **Loop check (report only, changed after testing)**: compare `captureSnapshot()` before the press and after the post-roll. A clip whose view or cursor differs is kept and flagged "not looping", never rejected, because many views cannot be undone (leaving a view that is not in the graph, exit). Screen text that differs outside the cursor rows while the view is the same is flagged `valueChanged`, and the runner puts the project back. Text is used, not pixels, because the cursor blink changes pixels.
- **Timeline check**: times sorted, masks 0–255, last mask 0, last event before the clip end, first event at least 300 ms.
- **Sync check** (warning only): the first change of `textUnderCursorAtom` after the first press should occur 0–250 ms after that press, on the same clock as `t0`. Shortcuts that do not change the cell under the cursor (`play`, `mute-track`, `solo-track`, `clear-mutes`, `stop-track`) will not trigger it, so for those the check is skipped, not failed.
- Failed jobs go to a `_rejects/` folder, not into `activity/`.

## 4. Calibration (once per machine)

0. **Echo test, no code needed**: open "M8 SDK Test" from External Apps, send a few keys with Send Key, and watch whether `keyPressed` events come back. This answers the open question in section 1 and can be done today.
1. **Golden test**: re-record `song/play` and `song/navigate`, which already exist. Compare the new timeline with the existing one and the new clip with the existing MP4 (size, duration, look). This proves the whole pipeline before any missing media is made.
2. **Key timing and visual latency**: if the echo works, compare the `keyPressed` arrival time with the `sendKeyDown` call time to get the SDK-to-device delay, and shift the timeline by its median. Then measure the time from the key call to the first screen-text change. Expected: tens of milliseconds. The timeline does not need correcting for this, because the button overlay should show the press a little before the screen reacts.
3. **Start offset**: find the gap between `recorder.onstart` and the first encoded frame. Use ffmpeg on one calibration clip to measure it. ffmpeg is installed (winget, Gyan.FFmpeg 9.0.2, in the user PATH, so a terminal opened before the install needs a restart). If the gap is under one frame (33 ms), it can be ignored.
4. **Offline media check** (`scripts/check-media.mjs`, new, run after each batch): for every new clip run `ffprobe` for codec, size, pixel format and duration, and compare the duration with the last timeline event plus the post-roll. For reference, the existing clips are H.264 `yuv420p` 480×320 with variable frame rate, and their duration runs 0.9 to 3.5 s past the last key event.

## 5. Execution order

| Step | What | Output | Gate |
|---|---|---|---|
| 0 | Decisions D1–D8 | answered, section 9 | done |
| 1 | M8 Model:02 is loaded with `LAAMAA_SNOWYDAY` (section 7) | project loaded | done; the runner re-checks `deviceModel` in `getState()` |
| 2 | Write `build-media-jobs.mjs` and generate `media-jobs.json`, each job tagged `pass: 1` or `pass: 2` | 47 pass-1 jobs, 36 deferred | dry-run listing reviewed |
| 3 | Write `public/media-capture.html` in yam8d (3.1) and add it as an External App | working runner page | opens in External Apps and shows "Connected"; no yam8d source file changed |
| 4 | Calibration and golden test (section 4) | recording matches existing style | you review one clip next to its original |
| 5 | Pilot: 5 jobs covering each class: reference keyboard (`scale/play`), compiled navigation, attended (`song/navigate-views`), double-tap (`song/insert-unused`, `2x`), Select Mode with a clipboard (`instrument-pool/paste-value`), compiled with prerequisite state (`song/stop-track`) | 5 clips | you review each in the m8-shortcuts player |
| 6 | Pass 1: the remaining graph-reachable jobs, automatically except `navigate-views`, which is attended (47 in all, 5 already done in the pilot) | up to 42 clips | QA gates pass |
| 7 | Pass 2 (later, after you review pass 1): the 33 non-graph jobs in attended mode, one screen at a time. The 3 touch/MIDI jobs stay deferred | up to 33 clips | QA gates pass |
| 8 | Import and audit: move passing clips into `public/assets/activity/`, re-run the missing-media audit | `MISSING_MEDIA.md` updated | after pass 1: 36 missing (33 pass 2 + 3 deferred) |

## 6. Acceptance criteria

- After pass 1 the audit reports 36 missing: the 33 pass-2 placements and the 3 deferred under D5. After pass 2 it reports 3.
- Every JSON parses, is sorted, ends at mask `0`, and has its last event before the clip's end.
- Every MP4 is 480×320 H.264 `yuv420p`, and its duration, read with `ffprobe`, equals last event + post-roll (within one frame). `scripts/check-media.mjs` reports this.
- Clips that do not loop are flagged "not looping" and listed for review; `valueChanged` clips are listed too.
- You have reviewed every `needsReview` clip (16 in pass 1, 12 more in pass 2) in the m8-shortcuts player.

## 7. Device setup (you)

These are the things the code cannot do for you.

- Connect the M8 over USB in Chrome or Edge, and keep this tab in the foreground. Background tabs throttle timers, which distorts the recipe timing.
- The reference project is `LAAMAA_SNOWYDAY`, already loaded on the M8 Model:02. If a screen needs different content, any demo can be loaded from the Project view Load action (cursor at 14,14). The runner reloads `LAAMAA_SNOWYDAY` after destructive jobs (3.6), so keep the SD card accessible.
- Content each screen needs before its clip can show something useful. Pass 1 screens are checked in the dry run, because the demo's actual content is not known to this plan; the pass 2 screens are listed for later:
  - Song, Chain, Phrase, Table, Groove, Scale: a project with at least one non-empty phrase, chain and table.
  - Instrument, Instrument Pool, Modulators: several instruments with names, one with at least one modulation slot filled.
  - (pass 2) MIDI Mappings and MIDI Settings: at least one mapping, so `delete-mapping` has something to delete.
  - (pass 2) File Browser: a few files on the SD card.
  - (pass 2) Sample Editor: one loaded sample.
  - (pass 2) Limiter, Mix Scope, Equalizer Bank: nothing special.
  - (pass 2) Theme, Time Stats, System Settings: nothing special.
- Turn off the background shader and VJ mode. Keep the default smooth-rendering settings, which are the ones the existing videos most likely used.

## 8. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Screen canvas is an `OffscreenCanvas` placeholder, so `drawImage` from it can come out blank | black frames | The plan already feeds the copy canvas from `captureStream()` through a hidden `<video>` (3.1 item 3). Test during step 4. Fallback: force the screen canvas to 480×320 at DPR 1 and capture it directly. |
| Fragmented MP4 has no header duration | the page cannot read duration from the header | the page uses a `<video>` element; the audit uses `ffprobe` |
| Recipes leave the project changed | next job starts from a different state, loop jumps | restore step after each job (3.6); reload the saved project for destructive ones |
| Chrome does not record MP4 here | an extra step | WebM plus ffmpeg transcode |
| Background-tab timer throttling | recipe timing drifts | keep the tab in front; the runner checks `document.visibilityState` before each job |
| Key timing is logged at the SDK call, not at the serial write | timeline up to about 20 ms early, more if calls are queued back to back | calibrate in section 4; use the `keyPressed` echo if available; add the optional `connection.ts` tap only if needed |
| Cursor blink changes pixels | false loop failures | loop check uses screen text, not pixels |
| Views not in the graph | manual steps | deferred to pass 2, run in attended mode: the runner names the place, the user navigates, then clicks Run |
| Touch and MIDI gestures | not reproducible by keys | deferred (D5) |
| Model 01 vs 02 layouts differ | inconsistent clips | Model:02 chosen (D1); the runner refuses to start if `getState().deviceModel` differs from the value seen in the golden test |

## 9. Decisions (answered)

- **D1. Device.** M8 Model:02.
- **D2. Reference project.** `LAAMAA_SNOWYDAY` is loaded. Any other demo can be loaded from the Project view Load action at cursor 14,14.
- **D3. Format.** MP4 directly from Chrome, audio off. The WebM plus ffmpeg fallback only applies if Chrome cannot record MP4 here.
- **D4. Frame rate.** Every frame the screen draws (60 fps at most). A 30 fps cap on the screen stream halved the clip: the page measured 91 of 180 source frames with it and 178 of 180 without. The timer only repeats the last frame while the screen is idle. Recording with Chrome's MediaRecorder also fixes the encoder's quantiser, so more bitrate or H.265 did not sharpen red text in tests; a larger even-multiple output (4x) did. H.265 is not offered: Chrome records it only with the hardware encoder, which starts ~700 ms late against the 250 ms start-lag guard.
- **D5. Touch and MIDI (3 placements).** Deferred.
- **D6. Non-graph screens (33 placements).** Deferred to pass 2. Pass 1 is the 47 automatable jobs. In pass 2 the runner asks the user to navigate to a specific place and starts only when the user clicks Run (attended mode, 3.5).
- **D7. `navigate-views` direction.** The minimap in the bottom-right corner shows where Shift+Up/Left/Right/Down lead, and it is text, so the runner reads it from the screen text rows. The runner asks the user to navigate to the screen and click Run (attended mode). The clip goes one way and comes back with the opposite key so it loops on the same view.
- **D8. Orphan media.** Yes. Done: `edit-note` added to the Table screen and `{ "id": "navigate-screen", "media": "navigate" }` added to the Equalizer screen in `m8-shortcuts.dataset.json`.

## 10. Not done here

- Nothing has been run against the real M8: the echo test, the minimap parse and the project reload need the device (section 11).
- `scripts/check-media.mjs` (section 4.4) is not written. Check clips with `ffprobe` until it is.
- No commits.
- yam8d is not changed: the runner is two static files in `public/`. It still has to be added as an External App (section 11).

## 11. What was built (2026-10-09)

**Files**

- `m8-shortcuts/scripts/build-media-jobs.mjs` writes `scripts/media-jobs.json` (85 jobs: the 83 missing placements plus 2 golden-test clips). `--list` prints without writing. Its summary reproduces the plan's counts exactly: 83 total, pass 1 = 47 (31 reference + 16 compiled), pass 2 = 33 (21 + 12), 3 deferred.
- `yam8d/public/media-capture.html` is the runner page (the one file named in 3.1).
- `yam8d/public/media-capture-core.js` holds the pure logic (timeline and loop checks, minimap parse, recipe resolution) so it can be tested in Node. This is a second file the plan did not name.

**Running it**

1. `cd m8-shortcuts && node scripts/build-media-jobs.mjs`
2. Start yam8d (`http://localhost:5173/`), connect the M8, and in Settings add an External App with URL `media-capture.html`. Keep the tab in front.
3. In the page: choose the m8-shortcuts folder, then Echo test, then the golden jobs (filter Pass = 0), then the pilot jobs.

**Where files go**

- Passing clips: `public/assets/activity/<folder>/<slug>.{mp4,json}`.
- Rejected clips: `scripts/_rejects/<folder>/`. "Move rejected files into activity/" promotes one after you reviewed it.
- Golden clips: `scripts/_golden/` (never over the originals).
- Results of every run: `scripts/media-results.json`.

**Differences from the plan**

- The SDK's `sendKeyDown` takes key names (`['shift', 'opt']`), not a mask. The runner converts each mask to names. `sendKeyDown` still sets the whole held-key state.
- `t0` is not `recorder.onstart`. In headless Chrome `onstart` fired 3.8 s after `start()` (the first `MediaRecorder` of a page cold-starts its encoder; later ones start in 2 ms), and the file's time zero was a stale first frame, so a timeline measured from `onstart` was 3.8 s out of sync with the video. The runner now warms the encoder once with a throwaway recording, sends no frames until the recorder is ready (`captureStream(0)` + `requestFrame()`), takes `t0` at the first frame, and rejects any clip whose recorder start took over 250 ms. After this the first key press appeared in the video about 50 ms after its timeline entry (capture pipeline latency, as expected in 4.2).
- Jobs with a prompt in their setup (`stop-track`, `copy-mod-slot`, `paste-mod-slot`, `delete-mapping`, `insert-note-off` when the cursor text is not `---`) pause for a click on Run. These steps are my decisions, not in the plan: Live Mode is entered with Shift+Left and a track is cued with Play; `paste-mod-slot` copies a slot, then asks you to move to another slot; `instrument-pool/paste-value` copies the instrument with Shift+Opt on the name column, steps Down one slot, then records Shift+Edit (see the correction below).
- A clip that does not end where it started is kept with a "not looping" warning, not rejected (your decision after the first pass-2 tests). Only a bad timeline, a bad video, a hidden tab or a slow recorder start reject a clip.

**Correction after your tests (Instrument Pool, manual p.24):** on the pool's instrument name column Shift+Opt copies the instrument directly and Shift+Edit pastes it, with no Select Mode. So section 2/3.5's Select Mode prerequisite for `instrument-pool/paste-value` was wrong: I removed it from that placement in the dataset (`"prereqStateIds": []`), and the builder now puts the cursor on the name column (column 8, row 6: the name column spans columns 4-15 and the mixer columns start at 16) for `copy` and `paste-value`, and on the first mixer column (17, 6) for `edit-large`, `edit-small` and `set-default`. `paste-value` uses `instrument/paste` as its reference. `node scripts/build-media-jobs.mjs --redo <folder/slug,...>` lists clips that already exist so they can be re-recorded (tick "Overwrite existing files").
- A rehearsal (checkbox) runs the whole job without recording or writing and is stored as `rehearsed`, never `passed`.

**Verified against a mock M8 host (not the device)**: connection, recording to H.264 `yuv420p` 480x320 MP4, timeline against the video, attended and auto flow, setup and restore steps, loop-check rejection into `_rejects/`, echo test, batch run. 82 recipes pass the timeline rules in a Node test.

**Still unverified on the real device**

- Whether the M8 echoes keys back (the echo test answers it).
- The minimap region and the letter-to-view table in `media-capture-core.js` (`MINIMAP_REGION`, `VIEW_LETTER`) are a first guess from the plan's example. The page shows the raw region and the graph cross-check, so fix them from the first real snapshot.
- The project reload (`LAAMAA_SNOWYDAY`): it assumes `browseFile` loads the project. When the project was changed the M8 shows a confirmation that changes will be lost; the runner detects that dialog by its text, finds the confirming option from the text under the cursor, and asks you to confirm it if it cannot. The dialog's wording and default option are not known yet: the log prints the dialog text, so correct `DIALOG_RE`/`CONFIRM_RE` in `media-capture.html` from it.
- Whether `cursorPos` from the SDK is in the same text-grid units as `navigateTo`. If not, every auto job falls back to attended.

## 12. Context and choreography (2026-10-10)

The first clips were recorded wherever the cursor happened to be (the centre of a screen-wide zone), from references copied off other screens, with fixed robot timing. `project/edit-large` was recorded on the project NAME, for instance. The builder and the runner now set up the right context before each clip and play the shortcut the way a person would. Everything below was rehearsed on the Model:02 (firmware 6.5) through yam8d's SDK.

**Builder (`scripts/build-media-jobs.mjs`)**

- Every shortcut has a choreography (`SPECS`) instead of a copied reference. Most of them undo themselves so the clip loops: coarse and fine edits go 3-5 steps one way and as many back (the count is drawn per job; two looked shy), navigation clips walk 4 cells down, across, 4 up and back (down first, `NAV_MOVES`), toggles (play, mute, solo, live mode, bookmark, EQ mute, enable key) happen twice, inserts are cut again, names get a letter typed and deleted, pastes on Instrument and Instrument Pool are undone or cleared. Select Mode shortcuts show the selection being made (Shift+Opt, then arrows) before the shortcut itself.
- Timing is drawn from the 214 hand-recorded timelines (tap p50 96 ms, modifier-to-key p50 288 ms, key-to-modifier-release p50 144 ms, first press p50 712 ms, bimodal gaps), per job with a seeded random generator: `--seed N` makes another take. Those clips felt quick, so every pause and look is multiplied by `--pace` (default 1.4; taps and double taps keep their speed). Each job also keeps the pause after its last key (`tailMs`), and the post-roll is 900 ms, so the clip shows the result.
- Set default (and Render's delete/reset) first changes the value two large steps plus three or four small ones on top (Edit held, Up twice, then Right; mirrored on both axes for a high value), then resets it, so the reset is visible.
- Previews (Edit+Play on Instrument and Modulators, Play in the file browser, Instrument Pool and Sample Editor, and the Play hold of lazy chop) keep the key down 4-5 s: the M8 previews only while it is held. Solo side (Opt+Left, then Opt+Right) holds each 2.5-3.5 s.
- Mute and solo: the release order decides. The clip holds Option+Shift (or Option+Play) 1.2-1.8 s, muted while held, then releases Option first: the mute stays. After a look, the same gesture (Option released first again) removes it, so the clip loops. Clear-mutes keeps a mute that way, then Opt+Shift+Play with Option released last. The current track is the one that is muted, so the song starts on track 3 or 4 (not track 1) on a Song cell whose chain is not 00, FD or FE (kept for silence and stop by convention), on a row with at least four sounding chains when there is one (`context.play`, `core.songPlayStart`); on the Song screen the cursor goes on such a cell too. When no visible row has one, the runner warns and falls back to track 1.
- Navigate views takes a trip of up to four views with Shift held (three for sub-views) and comes back the same way (Song -> Chain -> Phrase -> Instrument -> Table and back). A trip that starts by going down is preferred to one that starts by going up. Each step must be undone by the opposite key; Mixer edges are used only when nothing else goes further. Ambiguous moves go where the M8 remembers (Project Shift+Down went to Chain, Mixer Shift+Up to Instrument), and the way back is still the reverse. Sub-views leave and go on until the clip shows three views (they cannot be re-entered with Shift).
- Each job has a context: `transport` (stopped, or playing for mute/solo/clear), `mute` (latched first, for clear-mutes on sub-views), `presets` (Song/Chain cursor first, so Chain/Phrase show the right content), `instrument` (an instrument of a given type, or an empty slot), `target` (the start cell, found by content: `value`, `empty`, `note`, `file`, `dash` for an unused name letter, a regular expression, a command to its left, room below, a value N rows below), `seek` (where to look for content when the screen has none) and `setup` (copy something first, store a snapshot...). The start cell avoids TYPE, FONT OPTIONS and the modulator type.
- `route` reaches the screens that are not graph nodes automatically (button positions measured on the device): MIDI Settings / Mappings, File Browser, Render, Time Stats, System Settings, Theme, EQ, Scope, Sample Editor. Only `delete-mapping`, `delete` (file browser) and `delete-slice` stay attended, and touch/MIDI stay deferred.
- New options: `--generated` (re-record the clips the runner made earlier: untracked or modified in git), `--screens`, `--seed`, `--out`.

**Runner (`yam8d/public/media-capture-runner.js`, used by `media-capture.html`)**

- `prepare(job)`: release keys, leave dialogs, sub-views and Select Mode, stop playback, clear mutes/solos; then start the song if needed, latch a mute, set cursor presets, follow the route, page to the instrument type, put the cursor on a fitting cell (seeking other tables, or other Song cells for chains/phrases), run the setup steps. A gesture with `mirror` is flipped when the value would clamp: a hex value of 80 or more, or a first move that does not change the value (tried unrecorded and undone). If the setup fails, the page falls back to asking you.
- `cleanup(job)`: leave Select Mode and sub-views, stop playback, clear mutes/solos, put the value back or reload `LAAMAA_SNOWYDAY` (`reload-if-changed` only reloads when the screen text changed), then check Select Mode once more. Select Mode counts as off only when two readings in a row say so (the flag comes from the cursor shape and can lag), with up to three Option presses.
- `settle()`: the same neutral state (keys released, no Select Mode, sub-view, playback, mute or solo) when a job fails, is skipped or stopped; the page calls it before moving on. It does not reload the project.
- The play state is read from the screen: the track panel (rows 7-14, columns 33-38) shows notes while playing and `M`/`S` before muted/soloed tracks; play heads (`<`, `>`) move.

**Device facts found on the way**

- Mute/solo latch: Option down, the key down, Option released first keeps it; releasing the key first undoes it. Clear (Opt+Shift+Play) only works when Option is released last. In sub-views (Scope, EQ) a kept mute/solo always leaves the view for the Mixer, even after a long hold, so those clips keep it, remove it in the Mixer and re-enter with Shift+Right (as the hand-recorded Scope clip did). An Option released 400 ms or more after the other keys does not leave, which clear-mutes relies on there.
- Solo side (Opt+Left/Right) only lasts while held, whichever key is released first.
- Option in Select Mode copies and puts the cursor on the row below the copied block; Shift+Edit pastes and puts it below the pasted rows.
- In Phrase, a second Shift+Play restarts the song; Play stops it. Edit+Up on an FX command opens the help on that command, and releasing Edit without moving puts it back (moving can clamp at the list edge and land elsewhere).
- Scale: Opt+Up shows the last scale, Opt+Down the first one. FM algorithm 0B is the last: Edit+Right clamps there.
- Instrument Pool: Edit+Opt on a name asks "CLEAR INSTRUMENT? OK CANCEL" (Edit confirms). Name fields: Option+Edit deletes a letter; holding Edit opens a keyboard.
- Reloading the project from the Load action did not ask to confirm lost changes on this firmware.
- Leaving the Sample Editor after a change asks "EXIT WITHOUT SAVING CHANGES? OK CANCEL" (OK selected): the runner confirms it, which also discards the clip's change, so Sample Editor clips need no reload.
- yam8d's `navigateToView` only resolves when the view changes: inside a dialog (no view name) it never answers. The runner bounds every SDK call with a timeout (`SDK_TIMEOUT_MS`), so a stuck call fails the job instead of freezing the batch.
- The demo song has no NXT or TBL command in any table, so `table/new-instrument` and `table/clone` fall back to asking you to set one up. Interpolation and new-table jobs can take 40 s to find a fitting phrase the first time; later phrase jobs start from the phrase already shown.

**Running it**

1. `node scripts/build-media-jobs.mjs --all` lists every placement (315 jobs with the 2 golden ones; `scripts/media-jobs.json` was written that way). `--generated` lists only the missing clips plus the ones the earlier runner made. With `--all`, "Overwrite existing files" also replaces the hand-recorded originals: their status shows `exists`, the runner-made ones `new`.
2. In the runner, tick "Overwrite existing files" and set the status filter to "all": `scripts/media-results.json` still marks the earlier clips as passed. "Rehearse (no recording)" runs the same setup, gesture and cleanup without recording.
3. Review the clips marked `*` (needs review) in the player.

## 13. Start cells, resume, manual clips (2026-10-11)

**Start cells on data.** A target without its own `near` used to start at the centre of its zone: row 08 of a phrase or song, often empty, so copies, cuts and selections showed empty rows (`phrase/fill` and `phrase/randomize-pattern` started on `---`). The builder now uses the zone's first cell (row 00, first column), where a song's data is entered, and `core.findCandidates` puts blank cells after every filled one for `any`. For a selection (`room.down`) it prefers a start with data in the rows it covers. Each blank costs as much as three rows of distance. Explicit `near` values and `START_CELL` (tempo, track 3 volume...) are unchanged; the golden jobs keep the centre. `scripts/media-jobs.json` was regenerated with `--all`: only `cursor` and `context.target.near` changed (173 jobs).

**Resume.** A batch writes `scripts/media-batch.json` (its jobs, options and each job's outcome) when it starts and after every job. When it stops (Stop, a failure with "Stop the batch on a failure", a reload of the page), "Resume batch (N of M left)" runs the jobs that have not passed yet. It keeps the order and the batch's own Rehearse and Overwrite settings. A job counts as done when it passed, was rehearsed (rehearsal batch) or skipped in the batch, or passed afterwards (run by hand, or promoted from the rejects). Skip now drops only the current job; it used to stop the whole batch.

**Manual clips.** "Record manually" works on any job, deferred touch/MIDI ones included. The runner sets the context up as usual; adjust it on the M8 if needed, then click Arm. Your first key on the M8 starts the recorder, and the clip begins the lead-in (default 1000 ms, the median first press of the automatic clips is 950 ms) before it: the screen copy runs that far behind the screen. The clip ends once no key has been down for the idle time (default 2500 ms), keeping 1500 ms after the last release. Finish ends it sooner (900 ms after the last release); Skip drops it. The timeline is the key state the M8 reports (it sends every change of its keys, physical presses included), so it needs no Timeline shift. A key held while arming is ignored until it is released. Checked against a mock host in headless Chrome: the marker drawn while a key is down appears 50-100 ms after its timeline entry, the same offset as an automatic clip there (60-90 ms).
