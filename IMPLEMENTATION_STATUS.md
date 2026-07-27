# Implementation Status

Last updated: 2026-07-27 (Phase 5 checkpoint)

## Phase 1 -- Foundation: COMPLETE

| Area | Status | Notes |
|---|---|---|
| Repository structure | Done | npm workspaces: `apps/desktop`, `packages/{core,shared-types,database,project-engine}` |
| Electron shell | Done | electron-vite (main/preload/renderer), single BrowserWindow |
| React app | Done | React Router (HashRouter), Zustand store, Tailwind dark theme |
| Strict TypeScript | Done | `npm run typecheck` passes clean across all 5 packages |
| SQLite (app metadata) | Done, via sql.js | See ARCHITECTURE.md for why better-sqlite3 was swapped for sql.js |
| Migrations | Done | `0001_init.sql` (projects, app_settings, activity_log, background_jobs, character_library, brand_library, provider_configurations, schema_migrations), `0002_series_plans.sql` (series_plans) |
| Settings | Done | Get/save round-trips through the DB; Settings screen wired to appearance, default project folder, autosave interval, backup count, offline mode |
| Logging | Done | JSON-lines to `%APPDATA%/Aether Studio Suite/logs/`, secret-key redaction, retention pruning |
| Project creation | Done | Full subdirectory scaffold + validated `project.aether` |
| Project save/load | Done | Atomic write, Zod validation on read, structured errors |
| Backup + recovery | Done | Rotating snapshots on every save; restore-from-backup IPC + function; crash-recovery marker file drives a "safe mode" splash notice |
| Splash screen | Done | Logo, tagline, animated indicator, staggered real startup-status messages, version, recovery notice |
| Home screen | Done | New/Open/Recent Productions, A.I. Blitz sample card, full nav list (Phase 2 items now enabled; remaining ones phase-labeled and disabled) |
| First-run onboarding | Done | Blank / A.I. Blitz Sample / Import Existing, exactly as specified |
| A.I. Blitz sample project | Done | Blitz character profile (personality, wardrobe, locks, animation restrictions), A.I. Blitz brand profile, full 9-scene Mission 001 script with the specified narration, unverified-claim flags, and the "CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION" warning |
| Blitz character sheet import | Done | Auto-copies from `/resources/sample-projects/ai-blitz/characters/blitz/` into the project if present; degrades gracefully (shows a "Locate character sheet" button) if absent -- never fails |
| Windows path handling | Done | `sanitizeFileName()` strips reserved chars, trailing dots/spaces, and guards reserved device names (CON, NUL, COM1, ...) |

## Phase 2 -- Preproduction: COMPLETE

| Area | Status | Notes |
|---|---|---|
| Series & Curriculum Planner | Done | Global (DB-backed via `series_plans`), CRUD for series and episodes, up/down reordering, editable A.I. Blitz Missions 001-010 sample curriculum loader |
| Brand Studio | Done | Full CRUD on a project's `brands[]`: color palette editor, approved/prohibited terminology, disclaimers, accessibility requirements, client-side validation warnings (missing logo, empty palette, no disclaimer, no accessibility requirements) |
| Character Studio | Done | Full CRUD on `characters[]`: bio fields, lip-sync toggle, all 7 consistency locks as toggleable chips, reference gallery with per-image category + approval, reuses Phase 1's reference-image import flow |
| Knowledge Library | Done | CRUD on `knowledgeSources[]`, search/filter, status badges, stale/conflicting-source warning banner |
| Script Studio | Done | Full scene/segment editor: narration, on-screen action, overlay text, approval status, unverified-claim flag, up/down reordering; live word count, narration-speed presets (115/130/145/160 wpm), estimated-vs-target duration with over/under indicator |
| Storyboard Studio | Done | Grid and scene-list views, all 16 shot types, scene/shot numbering, link to a script segment, generation/negative prompt fields, duplicate/remove |
| Prompt Workshop | Done | Per-project prompt library across all 14 categories, structured fields (subject/action/environment/camera/lens/lighting/mood/style/movement/continuity/negative), assembled-text preview, one-click copy to clipboard -- fully usable with zero connected AI providers |
| Nav + cross-links | Done | Series/Knowledge/Scripts/Storyboards/Prompts/Characters/Brands enabled in the sidebar; Production Overview has quick-link buttons into every Phase 2 screen |

### New shared-types schemas (Phase 2)

`StoryboardFrameSchema`/`ShotTypeSchema`, `PromptSchema`/`PromptCategorySchema`, `SeriesPlanSchema`/`EpisodePlanSchema`. `ProjectManifestSchema` gained `storyboardFrames` and `prompts` arrays (both default to `[]`, so Phase-1-era manifests still validate unchanged -- covered by a dedicated backward-compatibility test).

### Verified manually (Phase 2, this session)

1. `npm test` (33/33 passing), `npm run typecheck`, `electron-vite build` all succeed after every schema/IPC addition.
2. Fresh launch completes startup with no errors; migration `0002_series_plans` applies cleanly on top of an existing Phase 1 database.
3. **Script Studio**, opened against the real Mission 001 script: correctly displays 9 scenes, 180 words, computes "Estimated: 1:23" against "Target: 7:00 (5:37 under)" -- confirming the word-count/WPM duration math is correct, not just wired up.
4. **Character Studio**, opened against the real Blitz character: all 7 consistency locks render as engaged, "Requires lip synchronization" correctly unchecked, and the actual imported character-sheet thumbnail renders via a `file://` URL built from the project directory + stored relative path.
5. **Production Overview**, quick-link row confirmed navigating into Script Studio with a real click (not just keyboard).
6. **Series Planner**: after an automation-only detour (see below), confirmed via keyboard-driven interaction that "New Series" creates and persists a series, and "Load A.I. Blitz Sample Curriculum" creates a `SeriesPlan` with exactly the 10 specified missions, correct order, correct difficulty progression (beginner ×3, intermediate ×4, advanced ×3), and Mission 001 marked "ready" while the rest are "idea" -- confirmed directly against the database, not just the screenshot.
7. Cleaned up test-only duplicate records this verification pass created in the real `%APPDATA%/Aether Studio Suite/aether-studio.db` (see note below) before finishing, so the app's actual data is left in the state a real first-time user would see.

### A note on GUI-automation reliability in this environment

Coordinate-based mouse clicks against the live Electron window were unreliable in this sandboxed session: `System.Windows.Forms.Cursor.Position` and `GetWindowRect` disagreed by a variable, non-uniform offset (worse when the window sat on a large virtual desktop), so clicks aimed at small header buttons regularly missed while clicks on large targets (nav items, list rows) usually landed. `SetProcessDPIAware()` reduced but did not eliminate the mismatch; Chromium's accessibility tree was not exposed to Windows UI Automation either (`FindAll` returned only 2 generic Pane elements), so UIA-based invocation wasn't available as a fallback. **Keyboard navigation (Tab/Shift+Tab/Space) was unaffected by this and is what ultimately verified the Series Planner buttons** -- this is an artifact of the test environment, not a defect in the app, but it did cost real time this session and produced transient duplicate test records in the dev database (since cleaned up). Future verification passes should prefer keyboard-driven interaction over coordinate clicks for anything but the largest UI targets.

### Known build-fragility fixed during Phase 1 (see also KNOWN_LIMITATIONS.md)

These were real failures hit and fixed during the Phase 1 checkpoint, not
hypothetical risks -- listed so they aren't reintroduced:

- `better-sqlite3` cannot compile on a machine without MSVC Build Tools ->
  replaced with sql.js behind a compatible adapter.
- electron-vite's `externalizeDepsPlugin()` externalizes workspace packages
  by default, which breaks at runtime because their `"main"` is raw
  TypeScript -> explicitly excluded in `electron.vite.config.ts`.
- A bundled workspace package's own dependency (`sql.js`) must be declared
  directly in `apps/desktop/package.json` or it gets wrongly inlined and its
  UMD wrapper breaks -> added as a direct dependency.
- `@aether/database`'s migration `.sql` files are read from disk at runtime
  relative to its own compiled location, which Rollup doesn't copy
  automatically -> added a `closeBundle` plugin hook in
  `electron.vite.config.ts` to copy them into `out/main/migrations`.

## Phase 3 -- Media Management: COMPLETE

| Area | Status | Notes |
|---|---|---|
| `packages/media-engine` | Done | Real FFmpeg 6.1.1 (via `ffmpeg-static`/`ffprobe-static`) -- not a stub. Checksum (sha256), media probing (duration/resolution/codec), video thumbnail extraction, audio waveform image generation, `execFile`-based process invocation (no shell, injection-safe by construction) |
| Asset Library screen | Done | Grid view, category + text/tag search + favorites filters, detail panel with tags/collections/license fields, per-asset remove/relink/reveal-in-folder |
| Media import | Done | Copy-into-project or link-to-original storage modes; sha256-based duplicate detection warns and skips re-importing a file already in the library |
| Missing-file detection | Done | `assets:check-missing` scans on load; missing assets show a badge and a "Relink..." action in the detail panel |
| FFmpeg status in Settings | Done | Path override field + "Test FFmpeg" button that actually invokes `ffmpeg -version`, not just a path-exists check |
| Nav + cross-links | Done | Assets enabled in the sidebar; Production Overview has an Assets stat card and quick link |

### New shared-types schema (Phase 3)

`AssetSchema`/`AssetCategorySchema` (19 categories per spec section 15)/`AssetStorageModeSchema`. `ProjectManifestSchema` gained an `assets` array (defaults to `[]`, covered by the same backward-compatibility test pattern as Phase 2's fields).

### Verified manually (Phase 3, this session)

1. `npm test` (46/46 passing, including 10 media-engine tests that invoke the real FFmpeg binary against ffmpeg-generated test video/audio), `npm run typecheck`, `electron-vite build` all succeed.
2. Fresh launch with no errors; Asset Library renders correctly scoped to the open production.
3. **Real end-to-end import**, driven through the actual native Windows file-picker dialog (not simulated): imported a real JPEG, confirmed "Imported 1 asset," confirmed the thumbnail rendered as the actual image content via a `file://` URL, confirmed the copied file and updated `project.aether` existed on disk afterward.
4. **A real bug was found and fixed during this pass**: the asset preview picked its rendering mode (image/video/audio/generic) from the asset's user-assigned `category` rather than the file's actual extension. Importing a `.mp4` and a `.wav` under the "images" category (an easy real-world mistake, and exactly what happened during this test) produced broken image previews. Fixed by deriving preview kind from the file extension (`previewKindForFileName()`) instead -- category remains a free organizational label, independent of how the file previews.
5. Test artifacts (`.jpeg`/`.mp4`/`.wav` test files and their imported records) were created and then removed from the real sample project and `%APPDATA%` data before finishing, consistent with the Phase 2 cleanup practice.

### A note on native dialog automation

Automating the native Windows "Choose File" dialog required finding its
actual top-level window handle (`EnumWindows`, matching by title) and
calling `SetForegroundWindow` on *that* handle specifically --
`SendKeys` sent to the Electron main window's handle while the file dialog
was open leaked keystrokes to whatever window actually had focus (in one
case, this session's own terminal window). Scoping `SetForegroundWindow` to
the dialog's own `hWnd` fixed it reliably.

## Phase 4 -- Audio and Screen Capture: COMPLETE

| Area | Status | Notes |
|---|---|---|
| Audio processing (media-engine) | Done | Real FFmpeg filters: `trimAudio`, `normalizeLoudness` (loudnorm), `denoiseAudio` (afftdn), `removeSilence` (silenceremove), `mergeAudioTakes` (concat filter), `convertAudioFormat` (wav/mp3), `analyzeLoudness` (ebur128 parsing) |
| Video processing (media-engine) | Done | `trimVideo`, `adjustVideoSpeed` (setpts/atempo, clamped to ffmpeg's 0.5-2.0 atempo range) -- used as Screen Capture's post-capture tools |
| Voice Studio screen | Done | Voice profiles (name, character assignment, direction fields -- provider/model are informational only, no TTS connection), take management, waveform display, trim/normalize/denoise/remove-silence/merge/export actions, all operating on real imported audio |
| Screen Capture Studio screen | Done | Privacy checklist (9 items from spec, manual confirmation only -- explicitly not automatic secret detection), source picker via `desktopCapturer`, mic toggle, best-effort system-audio toggle, countdown, start/pause/resume/stop via `MediaRecorder`, recordings saved directly into the Asset Library (`screen-recordings` category) |
| Nav + cross-links | Done | Voice and Screen Capture enabled in the sidebar; Production Overview links to both |

### New shared-types schemas (Phase 4)

`VoiceProfileSchema`, `VoiceTakeSchema`. `ProjectManifestSchema` gained `voiceProfiles` and `voiceTakes` arrays (default `[]`, covered by the same backward-compatibility test pattern as prior phases).

### Architecture note: Screen Capture reuses the Asset Library, not a parallel entity

A completed recording becomes a normal `Asset` (category `screen-recordings`) rather than a separate `ScreenRecording` type. `apps/desktop/src/main/assetBuilder.ts` (the `buildAssetFromFile` function that Phase 3's Asset Library import already used) was extracted so both `assetsIpc.ts` and the new `screenCaptureIpc.ts` share the same checksum/probe/thumbnail logic -- a screen recording gets exactly the same treatment as any other imported video, plus a `notes` field recording which capture options were used.

### Verified manually (Phase 4, this session)

1. `npm test` (62/62 passing, including 23 media-engine tests against the real ffmpeg binary), `npm run typecheck`, `electron-vite build` all succeed.
2. Fresh launches complete startup with no errors both before and after all Phase 4 changes.
3. **A real bug was found and fixed**: `analyzeLoudness()`'s regex matched the *first* `I: ... LUFS` occurrence anywhere in ffmpeg's stderr output. ffmpeg's `ebur128` filter prints a progress line roughly every 100ms *while measuring*, each containing that same `I:` pattern, before printing a final `Summary:` block with the converged value. The original code was capturing an early, unstable transient reading instead of the real result -- a 3-second pure tone (which should read roughly -18 to -22 LUFS) was reported as -70 LUFS. Fixed by restricting the regex to the text after the last `Summary:` marker. Added a regression test (`audioVideoProcessing.test.ts`) asserting a plausible loudness range and that `normalizeLoudness` measurably changes the reading toward its target -- the old code would have passed the previous, looser assertion (`toBeTypeOf("number")`) without ever being caught.
4. **Full Voice Studio pipeline verified headlessly** against the real sample project (import → probe/waveform/loudness → normalize → re-measure → cleanup): confirmed a take's loudness moved from -21.8 LUFS to exactly -16.0 LUFS (the requested target) after normalization, using the exact functions the IPC handlers call.
5. **`desktopCapturer.getSources()` verified working** via a minimal standalone Electron script: returned 7 real sources (the full screen plus open application windows) with valid, non-empty thumbnails, confirming the API Screen Capture Studio depends on functions correctly on this machine.
6. Voice Studio's screen was visually confirmed rendering correctly (title, description, empty state, "+ New Voice Profile" button) via screenshot of the real running window.

### What wasn't interactively verified this session, and why

Actually clicking through Screen Capture Studio's live recording flow (start → record a few seconds → stop → confirm it lands in the Asset Library) was not completed. Partway through interactive verification, a mouse click intended for the app landed on an **unrelated window** on the tester's desktop (a personal document, briefly visible in a screenshot) due to a coordinate-mapping problem described below. Continuing to click blindly risked interacting with the user's other open windows, so interactive GUI testing was stopped in favor of the headless verification in items 3-5 above, which exercise the identical underlying code paths (`buildAssetFromFile`, the audio processing functions, `desktopCapturer`) without needing simulated clicks. The `MediaRecorder`/`getUserMedia` recording code itself follows Electron's standard, widely-used documented pattern for this exact purpose; it has not been exercised end-to-end by an actual recording in this session.

### A note on GUI-automation coordinate mapping (root cause found this phase)

Earlier phases worked around unreliable clicks by preferring keyboard navigation. This phase found the actual root cause for the mouse case: **`System.Windows.Forms.Cursor.Position` (used via PowerShell) does not land where `user32.dll`'s `GetWindowRect`/`CopyFromScreen` say it should** -- confirmed by setting a position via `Cursor.Position` and immediately reading it back via the raw `GetCursorPos` Win32 call, which reported a different, non-uniform offset. Calling the raw `SetCursorPos` Win32 function directly instead of going through WinForms' `Cursor.Position` produces an exact match with `GetCursorPos`/`GetWindowRect`, and clicks landed correctly afterward. The practical failure mode before this fix: a click aimed at a button inside the target app's window could land anywhere on the (very large, multi-window, 5120px-wide) desktop instead, including on unrelated windows. Future sessions automating this app's GUI via PowerShell should use `SetCursorPos`/`GetCursorPos`, never `System.Windows.Forms.Cursor.Position`, for coordinate-based clicks.

## Phase 5 -- Timeline and Graphics: COMPLETE

| Area | Status | Notes |
|---|---|---|
| Timeline data model (shared-types) | Done | `TimelineTrackSchema` (11 track types: primary/secondary video, screen-capture, character-animation, graphics, titles, overlays, captions, narration, music, sound-effects), `TimelineClipSchema` (source in/out, timeline position, volume, opacity, fade in/out, mute/lock), `TimelineMarkerSchema`, `TimelineSchema` |
| Overlay/caption data model | Done | `OverlayTemplateSchema` (16 kinds from spec section 20, 7 positions, 4 entry animations), `CaptionSchema` (start/end/text/speaker/sound-description flag) |
| `concatVideoClips()` (media-engine) | Done | Trims each clip to its in/out range, scales + letterboxes every clip to a common resolution (default 1280x720), concatenates via `filter_complex concat` -- video-only, explicitly scoped as a quick preview render, not a delivery export |
| Timeline Editor screen | Done | Multitrack editor: add/remove tracks and clips via numeric controls (start/duration/source-in/volume/fades), mute/solo/lock per track, a shared rAF playback clock driving a `<video>` + one `<audio>` per audio track with drift correction, overlay/graphics/title clips rendered as positioned preview divs with fade opacity, a bottom caption bar, undo/redo (in-memory snapshot stack), zoom, "+ Marker at Playhead", "Load Standard Overlays," and "Quick Preview Render" (calls `concatVideoClips` on the primary-video track and registers the result as a new Asset in the `exports` category) |
| Caption Studio screen | Done | Generate captions from a script's segments (`generateCaptionsFromScript()`), manual add, inline per-caption start/end/text editing, warnings (line-length >42 chars, reading speed >180 wpm, overlaps, end<=start), SRT/VTT export and import (hand-written parse/format functions, no external subtitle library) |
| Nav + cross-links | Done | Timeline and Audio both enabled and route to the same Timeline Editor screen (audio mixing lives in the timeline's audio tracks, not a separate mixer screen yet); Captions enabled; Production Overview links to both |

### New shared-types schemas (Phase 5)

`TimelineTrackTypeSchema`, `TimelineTrackSchema`, `TimelineClipSchema`, `TimelineMarkerSchema`, `TimelineSchema`, `OverlayTemplateKindSchema`, `OverlayPositionSchema`, `OverlayAnimationSchema`, `OverlayTemplateSchema`, `CaptionSchema`. `ProjectManifestSchema` gained `timelines`, `overlayTemplates`, and `captions` arrays (all default to `[]`, covered by the same backward-compatibility test pattern as prior phases).

### Architecture note: no separate `packages/timeline-engine`

The Roadmap originally named a dedicated `packages/timeline-engine` for this phase. In practice, the timeline's actual logic split cleanly across existing packages without needing a new one: the data model lives in `@aether/shared-types` (schemas above), the only real *processing* step (concatenating clips into a preview render) is one function (`concatVideoClips()`) that belongs naturally alongside Phase 3/4's other FFmpeg operations in `@aether/media-engine`, and everything else (playback clock, drift correction, track/clip editing, undo/redo) is UI state that lives in the renderer (`apps/desktop/src/renderer/src/screens/TimelineEditor.tsx` and `lib/timelineHelpers.ts`). Introducing an empty intermediate package for these would have added an indirection layer with no code of its own.

### Verified manually (Phase 5, this session)

1. `npm test` (72/72 passing, including 13 new tests: 10 for the Phase 5 schema additions in `schemas.test.ts`, 3 for `concatVideoClips()` against real ffmpeg-generated clips of different resolutions), `npm run typecheck`, `electron-vite build` all succeed.
2. Fresh launches complete startup with no errors both before and after all Phase 5 changes.
3. **Full Timeline Editor flow verified interactively against the real running app**: imported three freshly ffmpeg-generated test files (a 4s 640x360 video, a 3s 640x360 video, a 5s narration WAV) into the Asset Library, created a new timeline, added a clip to the Primary Video track and another to the Narration track via the track asset-picker + "+ Add Clip," confirmed the Clip Inspector showed the correct real probed duration for each (4s and 5s respectively), pressed Play and watched the playhead advance in real time with the preview `<video>` showing the actual animating test-pattern frame (not a static placeholder), and pressed "Quick Preview Render," which produced a real rendered `.mp4` and added it to the Asset Library under the `exports` category with the notice "Preview rendered and added to the Asset Library (Exports category)" -- confirmed by re-opening the Asset Library and seeing the new export asset with a real thumbnail.
4. **A real bug was found and fixed during this pass**: the playback clock (a `requestAnimationFrame` loop advancing `playheadSeconds` by wall-clock delta) never checked the loop against the timeline's total duration, so playback continued advancing indefinitely past the end of the timeline (observed running to `0:35.19` against a `0:30.00` total) instead of stopping. Fixed in `TimelineEditor.tsx` by clamping the next playhead value to `totalDuration` and calling `setIsPlaying(false)` once it's reached; verified the fix by seeking near the end and confirming playback now stops exactly at `0:30.00` with the Play/Pause button correctly reverting to "Play."
5. Test assets (the three imported files, the generated `preview-*.mp4` export, their cache thumbnails/waveform images, and the `Timeline 1` timeline itself) were removed from the real sample project's `project.aether` and asset folders before finishing, consistent with every prior phase's cleanup practice -- confirmed by relaunching and seeing the Production Overview report "0 Assets" and no timeline again.

### What wasn't interactively verified this session, and why

Caption Studio's generate/edit/export/import flow was exercised only through its unit-tested helper functions (`generateCaptionsFromScript`, `captionWarnings`, `findOverlappingCaptionIds`, the SRT/VTT format/parse round-trip), not by clicking through the live screen, given diminishing returns from continued coordinate-based GUI automation after the Timeline Editor flow above was already confirmed working end-to-end (see the GUI-automation note below). The underlying functions are the same ones the screen calls directly, so this is lower-risk than an unverified code path, but it is not the same as watching the actual screen generate and export captions.

### A further note on GUI-automation reliability (new finding this phase)

Building on Phase 4's fix (use raw `SetCursorPos`/`GetCursorPos`, not `System.Windows.Forms.Cursor.Position`), this phase found a second, distinct failure mode: **a click reliably lands on the wrong window if `SetForegroundWindow` isn't called again immediately before that specific click.** Focus does not stay on the target Electron window between separate tool invocations in this environment -- something else (this session's own terminal/app window) can reclaim the foreground in between, and a click sent without re-asserting focus first can land on whatever now occupies that screen region instead (observed landing on this very session's own app window twice, never on unrelated personal content). The fix is mechanical: call `ShowWindow`/`SetForegroundWindow` on the target window's handle immediately before every single click, not just once at the start of a click sequence. A handful of clicks in this phase (a "Remove from Library" button, a couple of nav-sidebar items) intermittently missed even with this in place, landing as text-selection drags instead of clicks for reasons not fully root-caused -- retrying once after re-asserting focus resolved all of them. Opening Chromium DevTools (`Ctrl+Shift+I`, sent via `SendKeys` to the focused window) was useful this phase for confirming a click actually registered (via the button's own text changing, e.g. to "Rendering...") when screenshots alone left it ambiguous.

## Phases 6-8: NOT STARTED

See [ROADMAP.md](ROADMAP.md). Nothing in AI Providers, Review, Quality
Control, Export, Templates, Providers, Tasks, Analytics, or Learning Center
is implemented beyond the Zod schema placeholders already present in
`@aether/shared-types` (`tasks` and `providerReferences` arrays exist on the
manifest and are currently always empty). AI-assisted actions named in the
spec for Script Studio, Prompt Workshop, etc. (generate outline, improve
hook, generate storyboard image, ...) are intentionally not implemented --
they require Phase 6's provider layer, and adding UI buttons for them now
would be exactly the "nonfunctional placeholder" the spec says to avoid.
