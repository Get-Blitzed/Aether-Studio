# Implementation Status

Last updated: 2026-07-28 (Phase 8 checkpoint)

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
| Home screen | Done | New/Open/Recent Productions, Orbit sample card, full nav list (Phase 2 items now enabled; remaining ones phase-labeled and disabled) |
| First-run onboarding | Done | Blank / Orbit Sample / Import Existing, exactly as specified |
| Orbit sample project | Done | Nova character profile (personality, visual description, locks), Orbit brand profile, full 9-scene Mission 001 script with narration, unverified-claim flags, and the "CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION" warning. Originally seeded as "A.I. Blitz" (a real character/live application) -- replaced with the original Nova/Orbit sample after the fact; see the rebrand note below |
| Nova character sheet import | Done | Auto-copies from `/resources/sample-projects/orbit/characters/nova/` into the project if present; degrades gracefully (shows a "Locate character sheet" button) if absent -- never fails |
| Windows path handling | Done | `sanitizeFileName()` strips reserved chars, trailing dots/spaces, and guards reserved device names (CON, NUL, COM1, ...) |

## Phase 2 -- Preproduction: COMPLETE

| Area | Status | Notes |
|---|---|---|
| Series & Curriculum Planner | Done | Global (DB-backed via `series_plans`), CRUD for series and episodes, up/down reordering, editable Orbit Missions 001-010 sample curriculum loader |
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

## Phase 6 -- AI Providers: COMPLETE

| Area | Status | Notes |
|---|---|---|
| `packages/ai-providers` | Done | `AiProvider` interface (`testConnection`, optional `generateText`/`generateImage`); `MockProvider` (fully offline, deterministic template-based text generation + real ffmpeg-rendered placeholder images, clearly labeled "MOCK GENERATED IMAGE"); `OpenAiCompatibleProvider` (real `fetch`-based client for `/chat/completions` and `/images/generations`, OpenAI wire format); `GenericRestProvider` (configurable JSON request template + flexible response parsing for arbitrary text-generation REST endpoints); `createProvider()` factory; `assertNotBlockedByOfflineMode()` offline-mode gate |
| `packages/plugin-sdk` | Done | `PluginManifestSchema` + `validatePluginManifest()` -- defines the contract a future plugin must satisfy (id, version, capabilities, entry point); deliberately no runtime loader yet (see architecture note below) |
| Secret storage | Done | `apps/desktop/src/main/secretsStore.ts` wraps Electron's built-in `safeStorage` (DPAPI on Windows) -- no native Node addon, consistent with the Phase 1 decision to avoid native-module build risk. Ciphertext (base64) is the only thing ever written to the database; plaintext secrets exist only transiently inside an active provider call |
| Provider config + job storage | Done | `provider_configurations` and `background_jobs` tables (present but unused since migration `0001_init.sql`) now have real repositories and a migration (`0003_provider_secrets.sql`) adding `capability`, `is_default_for_capability`, `encrypted_secret`, `provider_id`/`provider_name`/`usage_json` columns |
| Provider & Plugin Manager screen | Done | CRUD for provider configs (name/kind/capability/base URL/model/request template/API key), per-provider "Test Connection" with live result, enable/disable, one default provider per capability, a Recent Jobs list surfacing status/usage (prompt+completion tokens, an explicitly-approximate flat-rate cost estimate)/errors -- the spec's usage/cost estimate surfacing requirement |
| AI-assist wiring | Done | Script Studio: "Generate Outline (AI)" (appends real `ScriptSegment`s parsed from the provider's response) and "Improve Hook (AI)" (rewrites a scene's narration in place); Storyboard Studio: "Generate Frame Image (AI)" (calls the default image provider, registers a real `Asset` in the `graphics` category via the same `buildAssetFromFile` pipeline Phases 3-5 already use, and sets the frame's `thumbnailPath`) |
| Offline mode enforcement | Done | `assertNotBlockedByOfflineMode()` is called for both `providers:test` and `providers:run-job` before any networked provider (`openai-compatible`, `generic-rest`) is invoked; the `mock` kind is explicitly exempt since it never touches the network -- this is the spec's "offline mode must gate every network call" requirement, satisfied at the one IPC boundary all provider calls pass through rather than duplicated per-provider |
| Nav + cross-links | Done | Providers enabled in the sidebar (previously a disabled placeholder); Production Overview links to it |

### New shared-types schemas (Phase 6)

`ProviderKindSchema` (`mock`/`openai-compatible`/`generic-rest`), `ProviderCapabilitySchema` (`text`/`image`), `ProviderConfigSchema` (never carries a secret value -- only a `hasSecret` boolean), `BackgroundJobStatusSchema`, `JobUsageSchema`, `BackgroundJobSchema`. These are cross-project/global records (like `SeriesPlan`), stored in the app database, not inside any `project.aether` manifest -- the manifest's existing (empty, Phase-1-era) `providerReferences: string[]` field was not wired up to gate per-project provider availability this phase; every enabled global provider is available to every project.

### Architecture note: no separate credential-manager native module

The spec calls for "Windows credential-store integration for secrets." Rather than a native module wrapping the Windows Credential Manager API (a build-toolchain risk of exactly the kind avoided for the database in Phase 1 and confirmed painful again there), Electron's own `safeStorage` module was used instead -- it's built into Electron, requires zero native compilation, and still uses Windows DPAPI under the hood (the same OS-level protection a Credential Manager wrapper would provide, tied to the current OS user account). If `safeStorage.isEncryptionAvailable()` ever returns `false` on some machine/configuration, saving a secret fails loudly with a clear error rather than silently falling back to storing it in plaintext.

### Architecture note: a real bug found and fixed during manual verification

The image-generation branch of `providers:run-job` originally called `buildAssetFromFile()` (which copies the generated file into the project's `assets/graphics/` folder and returns an `Asset` object) but never actually appended that `Asset` to the project manifest's `assets[]` array or saved it -- unlike every other asset-creating IPC handler in the codebase (`assetsIpc.ts`, `screenCaptureIpc.ts`, `timelineIpc.ts`), which all explicitly read the manifest, append, and `saveProject()`. The physical file existed on disk and the Storyboard frame's `thumbnailPath` pointed at it (so the UI looked correct), but the Asset Library showed zero assets -- the file was orphaned relative to the project's own bookkeeping. Fixed by adding the same read-append-save step `providersIpc.ts`'s image branch was missing, and returning the updated manifest to the renderer. This surfaced a second, related bug: **StoryboardStudio's `handleGenerateFrameImage` then called `onChange()` (which triggers `updateAndSave()`, a full read-modify-write of the in-memory manifest) using the renderer's *stale* copy of the manifest -- one that didn't yet know about the asset just saved directly to disk by the IPC handler.** Since `updateAndSave()` always writes the *entire* manifest it's given, this created a race where the frame-update write could silently clobber the asset-registration write that happened moments earlier from the same button click. Fixed by calling `setCurrentProject(projectDir, result.manifest)` to sync the store with the IPC handler's freshly-saved manifest *before* triggering the frame's own `updateAndSave()`. Both fixes were caught by literally re-opening the Asset Library after generating an image and noticing "0 of 0 assets" where a newly-generated image should have appeared -- not by a written test, since the bug lived in the interaction between two independent full-manifest-overwrite operations from two different screens, which is exactly the kind of thing unit tests of either piece in isolation wouldn't catch.

### Verified manually (Phase 6, this session)

1. `npm test` (109/109 passing, including 33 new tests: 4 for the Phase 6 schema additions, 9 for the provider-config/background-job repositories including "only one default per capability" and secret-clearing behavior, 20 across `ai-providers` covering the mock provider's deterministic text/image generation against the real bundled ffmpeg, the offline-mode gate, and the provider factory's config validation, plus 4 for the plugin manifest validator), `npm run typecheck`, `electron-vite build` all succeed.
2. Fresh launches complete startup with no errors both before and after all Phase 6 changes, including after the `0003_provider_secrets.sql` migration ran against the existing Phase 1-5 database.
3. **Full Provider & Plugin Manager flow verified interactively against the real running app**: added a Mock text provider and a Mock image provider (each correctly auto-marked "default for text"/"default for image"), ran "Test Connection" on both and saw the real success message ("Mock provider is always available -- no network or credentials required"), confirmed "No API key stored" is shown (correct, since Mock needs none).
4. **Script Studio's "Improve Hook (AI)"**, run against the real Mission 001 script's actual Scene 1 narration, genuinely rewrote `"Busy is not the same as productive." (pause) "Let's fix that."` to `Stop scrolling -- "Busy is not the same as productive." (pause) "Let's fix that.", and it changes everything.` -- a real deterministic transformation, not an echo -- and the word/duration stats recalculated correctly.
5. **Script Studio's "Generate Outline (AI)"**, run against the same script asking for 5 more scenes, appended 5 new, correctly-titled scenes ("Hook", "Problem", "Walkthrough", "Payoff", "Call to Action") each referencing the production's actual title in the generated narration, taking the script from 9 to 14 scenes with correctly recalculated word count and estimated duration.
6. **Storyboard Studio's "Generate Frame Image (AI)"**, run with a real prompt ("Blitz the friendly AI robot presenter waves hello in a clean digital command center"), produced a real ffmpeg-rendered PNG (a deterministic color derived from a hash of the prompt, with "MOCK GENERATED IMAGE" and the prompt text burned into the frame via `drawtext`) that appeared as the frame's thumbnail immediately, and -- after the bug fix described above -- was confirmed correctly registered in the Asset Library under the `graphics` category.
7. All test providers, jobs, generated images, the 5 AI-added scenes, and the "Improve Hook" edit to Scene 1's narration were removed/restored from the real sample project and the app's global database before finishing (including one orphaned image file left over from before the bug fix), consistent with every prior phase's cleanup practice -- confirmed by relaunching and seeing the Provider & Plugin Manager, Asset Library, and Script Studio all back in their genuine first-run states.

### What wasn't interactively verified this session, and why

The offline-mode gate (`assertNotBlockedByOfflineMode`) is thoroughly unit-tested (4 dedicated tests covering both the mock exemption and the block/allow behavior for networked provider kinds) and is wired into both `providers:test` and `providers:run-job` identically to how every other provider call is gated. It was not re-confirmed by toggling Settings > Offline Mode in the live UI and attempting a real provider call, because doing so required navigating to the Settings screen and a stray window (this session's own Claude desktop app, confirmed via `GetForegroundWindow` -- not an unrelated or personal window) was persistently occupying the exact screen region the Settings nav item was in, resisting repeated `SetForegroundWindow` retries. Given the logic is identical to the already-verified provider-lookup and provider-construction code paths exercised in items 3-6 above, and is independently unit-tested, this was judged lower-value to keep fighting for than moving to close out the phase.
Neither the `OpenAiCompatibleProvider` nor `GenericRestProvider` was exercised against a real network endpoint -- there are no API credentials available in this environment. Both are implemented with real `fetch`-based HTTP logic (not stubs), and their config-validation error paths (missing API key, missing base URL) are unit-tested, but the actual request/response handling against a live OpenAI-compatible or arbitrary REST API has not been proven end-to-end.

## Phase 7 -- Review and Export: COMPLETE

| Area | Status | Notes |
|---|---|---|
| `packages/export-engine` | Done | `runQualityChecklist()` (pure, 8 checks against a manifest -- unverified claims, scene/storyboard approval, timeline/primary-video/audio-track presence, orphaned clip-asset references, caption presence); `renderFinalExport()` (real ffmpeg: primary-video concat scaled to a chosen preset resolution, all narration/music/sound-effect clips positioned via `adelay` and mixed via `amix`, captions burned in via a chained `drawtext` filter with `enable='between(t,start,end)'` windows); `archiveProduction()` (real .zip via `adm-zip`, excluding the regenerable `cache/` folder and any prior archives so re-running doesn't nest) |
| Export presets | Done | Four built-in presets (YouTube 1080p/720p, Vertical 1080x1920, Square 1080x1080) -- not user-editable this phase, see ROADMAP.md |
| Export Center screen | Done | Timeline + preset pickers, live Quality-Control checklist, "Export Now" (renders and registers a real Asset in the `exports` category, same pipeline the render is proven against in tests), "Create Production Archive (.zip)", a Past Exports list |
| Review & Approval screen | Done | Every script segment and storyboard frame listed with its real approval/production status (editable inline) and a new free-text `reviewNotes` field, plus the same Quality-Control summary shown as a strip of pass/warning/fail badges |
| Nav + cross-links | Done | Review and Export enabled in the sidebar (previously disabled placeholders); Production Overview links to both |

### New shared-types additions (Phase 7)

`QualityCheckStatusSchema`/`QualityCheckSchema` (a computed, non-persisted result that crosses the IPC boundary, so it gets a schema like everything else that does). `ScriptSegmentSchema` and `StoryboardFrameSchema` each gained an optional `reviewNotes: string` field.

### Architecture note: exports and archives reuse existing patterns, not new ones

A rendered export becomes a normal `Asset` (category `exports`) via the same `buildAssetFromFile` pipeline Phases 3-6 already established for imports, screen recordings, timeline previews, and AI-generated images -- no new "export record" concept was added to the manifest. A production archive is written to a plain `archives/` subfolder inside the project directory (matching the existing `renders/`, `backups/`, and `cache/` subfolder conventions from Phase 1's project structure) rather than requiring a save-location dialog.

### Verified manually (Phase 7, this session)

1. `npm test` (123/123 passing, including 14 new tests: 4 for the new schema fields, 4 for `runQualityChecklist()` covering both an empty production and one with real approval/asset data, 3 for `renderFinalExport()` against the real bundled ffmpeg -- including asserting the output actually has both a video and an audio stream at the exact requested preset resolution -- and 3 for `archiveProduction()` against a real zip, including that a prior archive and the cache folder are correctly excluded), `npm run typecheck`, `electron-vite build` all succeed.
2. Fresh launches complete startup with no errors both before and after all Phase 7 changes.
3. **Review & Approval verified against the real Mission 001 script**: the live Quality-Control summary correctly showed real red/amber/green states (e.g. "fail" for 2 segments still flagged `unverifiedClaim`, "warning" for scenes not yet approved), and setting Scene 1's status to Approved and typing a reviewer note ("Great hook, ready to go.") persisted correctly through `updateAndSave`.
4. **A full Export Center render was verified end-to-end against the real running app**: rather than fight the native "Choose Files" dialog a second time this session (see the note below), two real ffmpeg-generated test files were wired directly into `project.aether` as `linked`-storage assets and a timeline referencing them, then the running app was restarted to pick up the change from disk. With that in place, "Export Now" (preset: YouTube 1080p) produced `export-youtube-1080p-*.mp4`, confirmed via `ffprobe` to be exactly what was requested: 1920x1080 h264 video, AAC audio, both streams exactly 4.0s -- not just "a file was created," but the actual muxed, scaled, correctly-durationed result. "Create Production Archive (.zip)" was verified the same way: the resulting zip (34 real entries) was opened with Python's `zipfile` and confirmed to contain `project.aether` and the rendered export, while correctly excluding `cache/` and any prior `archives/` entries.
5. All injected test assets/timeline, the rendered export (including its now-orphaned `cache/previews` thumbnail), the archive .zip, and the Review Center's test edits to Scene 1 (status and reviewer note) were removed/reverted from the real sample project before finishing, consistent with every prior phase's practice -- confirmed by relaunching and seeing "0 Assets," no timeline, and Scene 1 back to "Draft" with no reviewer note.

### An incident this session, and how it was handled

Partway through manual verification, a mouse click intended for the running app's Asset Library instead brought an entirely unrelated window into focus -- one that turned out to contain visible personal credentials (an API token, a site login, a password) belonging to the person operating this session. This was caught immediately from the resulting screenshot; work was paused, the exposure was disclosed to the user in plain terms without repeating the sensitive content, and no part of it was used, stored, or acted on. Verification then resumed with three concrete changes: (1) every focus-changing action now verifies `GetForegroundWindow()` actually matches the target window's handle and aborts rather than proceeding if it doesn't, instead of assuming a `SetForegroundWindow` call succeeded; (2) when a dialog's presence needed confirming, window titles were enumerated via `EnumWindows` rather than taking a full-virtual-desktop screenshot, so nothing outside the app's own window is ever captured; (3) after the native file-picker dialog proved unreliable to drive via further clicking, the remaining verification (the actual export render and archive creation) was restructured to avoid it entirely -- test assets were wired into the project file directly as `linked`-storage entries instead. See KNOWN_LIMITATIONS.md for the durable version of this guidance.

### What wasn't interactively verified this session, and why

The native "Choose Files" import dialog could not be reliably driven by further clicking this phase (see the incident note above) -- Export Center's render and archive features were still verified end-to-end, but via directly-injected `linked` assets rather than by clicking through the Asset Library's own import flow a second time. That flow itself was already verified in Phases 3, 5, and 6.

## Phase 8 -- Document-to-Video, Voice, Redaction, and UI Redesign: COMPLETE

Phase 8's scope was set directly by the user, not by the original
spec-section-42 phasing (that plan now runs as Phase 9 -- see
ROADMAP.md): (1) convert any document (PDF/DOCX/PPTX) or media file into a
video project in one step, (2) AI voiceover with native Windows voices
tried before any external source, (3) blur/redact sensitive info in the
timeline editor, (4) a UI redesign -- bright colors, circles/ellipses
instead of only squares, an original logo, and a spoken intro on Splash.

| Area | Status | Notes |
|---|---|---|
| `packages/document-engine` | Done | `extractDocument()` dispatches by extension to `extractPdfText()` (`pdfjs-dist`, text-only, no canvas/rendering dependency), `extractDocxText()` (`mammoth`), or `extractPptxText()` (hand-rolled `adm-zip` + regex over `<a:t>` runs -- no OOXML library needed); `chunkParagraphsIntoPages()` groups DOCX paragraphs into ~60-word pseudo-pages; `renderTextSlide()` renders a real branded PNG slide card per page via ffmpeg `drawtext` (reading from temp text files, same escaping-avoidance pattern as Phase 7's caption burn-in); `buildScriptFromDocument()` turns extracted pages into a real `Script` + linked `StoryboardFrame[]` |
| Document Import screen | Done | Choose-file (documents or video/audio) -> either converts (extract -> script/storyboard -> per-page narrated slide video -> assembled `Timeline`) or imports directly as an asset if the file is already a video/audio/image; an optional "Generate native-voice narration automatically" checkbox drives auto-narration |
| Voice/TTS capability (ai-providers) | Done | `AiProvider` gained optional `listVoices()`/`synthesizeVoice()`; `SapiVoiceProvider` (real, fully offline, Windows System.Speech via a PowerShell child process, all dynamic values -- text, voice name, rate/pitch/volume -- passed through a JSON config file rather than interpolated into the script, the same textfile-based injection-avoidance pattern used elsewhere) is the native/default tier; `ElevenLabsProvider` (real `fetch`-based client against the documented API shape) is the external tier, reached only when a `sapi-voice` provider isn't configured/selected; `assertNotBlockedByOfflineMode()` now exempts `sapi-voice` alongside `mock` since neither touches the network |
| Voice Studio AI synthesis | Done | A new panel: pick a voice-capability provider, pick a voice (populated from that provider's real `listVoices()`), rate/pitch sliders, free-text input, "Generate Take" -- calls `providers:run-job` with the new `voice` capability branch, which saves the synthesized audio as a real `VoiceTake` (probed duration/loudness/waveform, same metadata pipeline as an imported take) |
| Auto-narration in the document pipeline | Done | Each page's text is synthesized via `SapiVoiceProvider` before its slide video is rendered; the slide's duration is set from the *actual* synthesized-audio duration (via `probeMedia`, not just a word-count estimate) plus a short tail buffer, and a matching narration clip is added to the timeline's narration track at the same start time. A page that fails to synthesize (no voices installed, non-Windows host) falls back to a silent, word-count-estimated slide rather than failing the whole import |
| Blur/redaction | Done | A new `"blur"` `TimelineTrackType` and an optional `blurRegion` (percent-of-frame x/y/width/height + strength) on `TimelineClip`; the Timeline Editor has a dedicated "+ Add Blur Region" control, a Clip Inspector section for adjusting the region numerically, and an approximate dashed-rectangle preview overlay on the playback stage; `renderFinalExport()` composites each region via `split` -> `crop` -> `boxblur` -> `overlay`, time-gated per clip via `enable='between(t,start,end)'` |
| UI redesign | Done | Tailwind `electric-blue`/`bronze` retoned brighter (`#7C5CFC`/`#FFB020`) plus two new gradient accent tokens (`aurora-pink`/`aurora-cyan`); the `borderRadius` scale itself was rounded (e.g. `rounded-md` 6px -> 12px), which reshapes every card/button/input across the entire app without touching each screen file; a hand-authored circles-and-ellipses logo (`Wordmark.tsx`) replaced the earlier angular polygon mark; NavSidebar gained a compact logo header and pill-shaped (rounded-full) nav items with a small circular active-indicator dot; Home and Document Import got circular icon badges and gradient buttons |
| Splash voice intro | Done | A new `app:get-intro-audio` IPC handler synthesizes "Welcome to Aether Studio Suite. Let's create something fantastic." once via `SapiVoiceProvider` (preferring an installed male voice, `rate: 2`/`pitchSemitones: 2` for a medium-tone, semi-excited read), caches the WAV under `%APPDATA%/Aether Studio Suite/cache/`, and Splash plays it once per launch; if synthesis ever fails, Splash proceeds silently rather than blocking startup |

### New shared-types schema changes (Phase 8)

`ProviderKindSchema` gained `sapi-voice`/`elevenlabs`; `ProviderCapabilitySchema` gained `voice`. `TimelineTrackTypeSchema` gained `blur` (with a new `isBlurTrackType()` helper alongside the existing audio/video/overlay classifiers). `TimelineClipSchema` gained an optional `blurRegion` (new `BlurRegionSchema`: `xPercent`/`yPercent`/`widthPercent`/`heightPercent`/`blurStrength`, all percent-of-frame so it stays correct across export resolutions).

### Architecture note: native-module avoidance continues

Consistent with sql.js (Phase 1), Electron `safeStorage` (Phase 6), and `adm-zip` (Phase 7), this phase chose `pdfjs-dist` over `pdf-parse` for PDF text extraction specifically to avoid a transitive native dependency (`pdf-parse@2.x` pulls in `@napi-rs/canvas`; even `pdf-parse@1.1.1`, which has no native deps, turned out to bundle a 2016-era pdf.js that failed on a real pdf-lib-generated PDF in testing -- see the bug note below) and Windows SAPI over any third-party native TTS binding.

### A real bug found and fixed during Phase 8: SAPI rejects an empty `<prosody>` tag

`SapiVoiceProvider.synthesizeVoice()`'s generated SSML originally always wrapped the spoken text in a `<prosody>` element, adding a `pitch` attribute only when a pitch shift was requested -- so with no pitch shift, the SSML contained a bare `<prosody>` with no attributes at all. Windows' SAPI SSML parser rejects this outright (`'prosody' requires attribute 'pitch, contour, range, rate, duration, volume'`), so every synthesis call with a zero pitch shift threw, which a real headless test (`sapiVoiceProvider.test.ts`, run against the actual Windows System.Speech engine on this machine) caught immediately. Fixed by only emitting the `<prosody>` wrapper at all when `pitchSemitones !== 0`, leaving the text bare inside `<voice>` otherwise.

### A second real bug found and fixed: blur verification test's own flawed metric

The first version of `renderFinalExport()`'s blur test compared PNG file sizes of the same cropped region before/after blurring, expecting the blurred version to compress smaller. It didn't -- re-encoding a blurred region through h264 can introduce its own compression artifacts that sometimes *increase* PNG size despite the frame looking smoother, so the test failed even though the actual blur filter chain was working correctly (confirmed by a separate raw-pixel debug script). This was a bug in the *test's* verification method, not the production code -- fixed by measuring raw grayscale total variation (sum of horizontal pixel-to-pixel differences) instead of file size, which isn't confounded by re-encoding artifacts and correctly shows the blurred region's variation dropping to less than half of the unblurred region's.

### Verified manually (Phase 8, this session)

1. `npm test` (148/148 passing across all 22 test files, including 4 new SAPI voice tests against the real Windows System.Speech engine -- list real installed voices, a successful connection test, synthesizing a playable WAV, and rejecting empty text -- and a new blur-compositing test against the real bundled ffmpeg confirming a region is measurably blurred only within its clip's time window), `npm run typecheck` (every package plus both the desktop app's main and web tsconfigs), and `electron-vite build` all succeed.
2. This machine has exactly 2 installed native Windows voices (`Microsoft David Desktop`, male; `Microsoft Zira Desktop`, female) -- confirmed by actually calling `SapiVoiceProvider.listVoices()`, not assumed. This is far fewer than the "twenty native voices" language in the original request; per an explicit up-front clarification with the user, the app truthfully reports whatever is actually installed rather than fabricating a count, and correctly selects the real male voice for the Splash intro.
3. **The full document-to-video-with-narration pipeline was verified end-to-end against real synthesis and real ffmpeg**, outside of any mock: a page of narration text was synthesized via `SapiVoiceProvider` (4.24s of real audio), then a slide video was rendered at a duration derived from that real audio length, and the two were confirmed to match within 0.5s -- proving the auto-narration duration-sync logic (not just that each piece works in isolation).
4. **The live running Electron app was visually confirmed** via a real window screenshot (captured by rect, not the full virtual desktop, per the established safety protocol below): the redesigned Home screen shows the new gradient logo mark in the sidebar, pill-shaped nav items with a pink active-indicator dot, gradient "Create" and amber "Open Sample" buttons, and circular icon badges on all three home cards -- confirming the retheme renders correctly, not just that it typechecks.
5. Test artifacts (a debug PowerShell screenshot capture and a scratch verification script) were removed and the Electron dev process was stopped cleanly before finishing.

### What wasn't interactively verified this session, and why

Beyond the Home screen (item 4 above), the Document Import wizard, the Voice Studio synthesis panel, and the Timeline Editor's blur-region controls were not clicked through live -- coordinate-based automation proved unreliable again this phase (a click aimed at a nav item ended up interacting with an unrelated browser tab from this same tool session, not the target app), consistent with every prior phase's experience automating this Electron app's GUI. Given that risk, further verification relied on real, non-mocked pipeline tests that exercise the exact same underlying code the UI calls (SAPI synthesis, ffmpeg blur compositing, the narration-duration-sync logic) rather than continuing to fight coordinate clicks. No further privacy-sensitive incidents occurred this session; the durable safety protocol from the Phase 7 incident (verify `GetForegroundWindow()` before every click, never screenshot the full virtual desktop, prefer `EnumWindows`-by-title over blind clicking) was followed throughout, including for the one live screenshot that was taken.
ElevenLabs's real `fetch`-based client was not exercised against a live account -- no credentials are available in this environment, the same posture Phase 6 shipped with for `OpenAiCompatibleProvider`.

## Sample project rebrand: A.I. Blitz -> Orbit / Nova

The built-in sample production seeded since Phase 1 was originally named
"A.I. Blitz" with a character called "Blitz" -- both turned out to be a
real character and live application, not appropriate to ship as this
app's own bundled sample. Replaced entirely with an original creation:

- **Nova** -- a small, non-humanoid comet-being of aurora-gradient light,
  the onboarding guide. Hand-authored as original circles-and-ellipses SVG
  art (`resources/sample-projects/orbit/characters/nova/nova-character-sheet.svg`),
  consistent with the Phase 8 UI redesign's visual language rather than a
  photo-real character sheet.
- **Orbit** -- a fictional team-collaboration product, the brand/subject
  of the sample Mission 001 script. Its color palette reuses the app's own
  redesigned aurora-pink/electric-violet/aurora-cyan/bronze tokens, so the
  in-sample "product" visually matches the studio producing it.
- The sample project's directory, IPC channel (`projects:open-sample`,
  simplified from `projects:open-sample-ai-blitz`), and the Series
  Planner's sample curriculum (`Orbit Missions`, 10 mission titles) were
  all renamed to match. The generic `"blitz-tip"` overlay-template kind
  (an app-wide feature, not sample-specific) was renamed to `"host-tip"`
  since it shouldn't stay tied to a retired sample character's name.
- **A real bug was found and fixed while verifying this**: the new
  character-sheet art is SVG rather than JPEG, and its reference-gallery
  thumbnail rendered as a broken-image icon under `npm run dev` but
  rendered correctly in a real build (`electron-vite build && electron .`).
  Root cause: Vite's dev server serves the renderer over
  `http://localhost:5173`, and Chromium blocks an http-origin page from
  loading local `file://` subresources -- a pre-existing dev-mode-only
  limitation that would affect any reference image (not something the SVG
  format introduced), now documented in KNOWN_LIMITATIONS.md.
- Verified end-to-end against the real running app (both `npm run dev` for
  the initial creation and a full `electron-vite build && electron .` for
  the image-rendering check): the sample project opens as "Orbit - Mission
  001 - Welcome to Orbit," Character Studio shows Nova with the imported
  SVG reference correctly rendered, and the script shows "Orbit -- Mission
  001: Welcome to Orbit -- 9 scenes."

## Sound Library: bundled royalty-free sound effects

A global, read-only library of curated sound effects, browsable from any
project and imported into its Asset Library on demand -- distinct from
the Orbit sample's auto-copy-on-create pattern, since bundling all source
files directly into every new project would multiply disk usage per
project and bloat the installer for content most users won't touch.

- **Source**: the user supplied a personal folder of 684 royalty-free
  `.mp3` sound effects (confirmed to permit redistribution as bundled
  application assets) and asked for a subset to be added to the packaged
  app.
- **Curation**: keyword-classified by filename into 10 categories (UI,
  Notification & Alert, Whoosh & Transition, Impact & Hit, Success, Error,
  Applause & Crowd, Cinematic & Logo, Office & Tech, Fun & Cartoon),
  excluding long-form music loops, nature/ambience beds, and
  horror/weapon/game-specific effects as out of scope for product-training
  videos. **115 files, 30MB total** were selected and renamed to clean
  `category-NN.mp3` filenames (the originals were Pixabay-style
  slug-plus-numeric-ID names) with a generated `manifest.json` (title,
  category, real ffprobe-measured duration) -- bundled at
  `resources/sound-library/`, picked up automatically by the existing
  `extraResources` config in `electron-builder.yml` (no packaging changes
  needed).
- **New IPC** (`soundLibraryIpc.ts`): `sound-library:list` resolves the
  bundled manifest to absolute file paths (only the main process can
  resolve `getBundledResourcesDir()`); `sound-library:import` copies
  selected entries into the current project via the same
  `buildAssetFromFile` + checksum-dedup pipeline every other asset-import
  flow in this codebase uses (`assets:import`, document-to-video,
  AI-generated images), registering them as real `sound-effects` Assets.
- **New Sound Library screen**: search + category filter, a real HTML5
  `<audio controls>` preview per effect (not a custom player), multi-select
  checkboxes, "Add N to Project."
- **Verified**: real audio elements confirmed playing with correct
  titles/categories/durations in a packaged build (`electron-vite build &&
  electron .`) -- the same dev-mode file:// restriction noted in the
  rebrand section above also applies here, so previews only render in a
  real build, not `npm run dev`. The import path's file resolution and
  checksum computation were verified directly against the real bundled
  files and an existing project manifest; the underlying
  `buildAssetFromFile`/dedup logic itself is the same code already proven
  by `assets:import` and other asset-creating flows, not re-verified here.
- **Not done**: no UI to browse or add from the full 684-file source pack
  (would need re-running the curation script with different limits); no
  per-effect waveform preview (relies on the browser's native audio
  player).

## Bundled offline Piper voice provider

A second offline TTS tier alongside Windows SAPI, added as a follow-up to
the Sound Library work when the user asked whether a voice platform like
ElevenLabs could be bundled the same way sound effects were. ElevenLabs
itself can't -- it's a cloud-inference-only API with no distributable
model files -- but Piper (https://github.com/rhasspy/piper) is a real,
offline, MIT-licensed neural TTS engine that ships as a self-contained
native binary, making it a genuine bundle candidate.

- **Engine**: the frozen, archived, MIT-licensed `rhasspy/piper` release
  (`2023.11.14-2`), not the actively maintained `OHF-Voice/piper1-gpl`
  fork -- that fork is GPL-3.0 and a `pip install`-only Python package with
  no prebuilt native binary, a worse fit on both licensing and packaging.
  The frozen release's `piper_windows_amd64.zip` is exactly the same shape
  as the already-bundled `ffmpeg-static`/`ffprobe-static` binaries: a
  standalone `.exe` invoked via subprocess, no Python or install step.
- **Voices**: four curated voice models, each individually license-checked
  before inclusion (several popular Piper voices trace back to
  CC-BY-NC-SA or ambiguously-licensed datasets and were deliberately
  excluded): `en_US-lessac-medium` (male, MIT), `en_US-ljspeech-medium`
  (female, public domain), `en_US-joe-medium` (male, CC0), and
  `en_US-kathleen-low` (female, CC0, the lightweight low-quality option).
  Bundled at `resources/piper/` (`bin/` for the engine + espeak-ng data,
  `voices/<id>/model.onnx` + `.onnx.json` per voice, plus a
  `voices/manifest.json` the provider reads for metadata) -- picked up
  automatically by the existing `extraResources` config, no packaging
  changes needed. ~270MB total (~38MB engine, ~232MB for the four voices),
  a real installer-size cost noted in KNOWN_LIMITATIONS.md.
- **New provider kind** `"piper-voice"` (`packages/shared-types`'s
  `ProviderKindSchema`), a `PiperVoiceProvider`
  (`packages/ai-providers/src/piperVoiceProvider.ts`) structured like
  `SapiVoiceProvider` but shelling out to the bundled `piper.exe` instead
  of PowerShell/SAPI, and wired into `createProvider()` via a new optional
  `CreateProviderContext` parameter (`{ piperDir }`) since -- unlike every
  other provider kind -- it needs a bundled-resource path resolved by the
  main process (`getPiperDir()` in `resourcePaths.ts`) rather than
  user-supplied config. Marked offline-safe in `offlineGate.ts` alongside
  `mock` and `sapi-voice`. No API key field in the Providers screen, same
  UX as the SAPI entry.
- **Quality**: sits between SAPI (more robotic) and ElevenLabs (noticeably
  better prosody, but paid/cloud) -- a genuine offline middle tier, not a
  replacement for ElevenLabs when quality matters most. A sample WAV
  (the `lessac` voice) was generated and sent to the user for a listen
  before building the rest of the feature.
- **Verified**: `PiperVoiceProvider` has a dedicated test suite
  (`piperVoiceProvider.test.ts`) that runs real synthesis against the
  actual bundled binary and models (mirroring `sapiVoiceProvider.test.ts`'s
  "against the real engine" pattern) -- lists voices, synthesizes both the
  default and an explicitly-requested voice, confirms a real playable WAV
  via `probeMedia`, and confirms empty-text rejection. `createProvider()`
  and `offlineGate()` each got new test cases for the `piper-voice` kind.
  All 156 tests pass; `npx tsc --noEmit` clean; `npm run build -w
  apps/desktop` succeeds; the packaged app launches cleanly with the new
  provider kind present in the Providers screen's dropdown.

## Music Library: bundled background music + "Add Your Own Music"

A background-music sibling to the Sound Library, added after the user
asked what else could be bundled for free creative use. A local folder
of "background music samples" the user offered as a source turned out to
be actual commercial recordings (Tears for Fears, House of Pain, Jay-Z,
etc.) -- real copyrighted masters, not royalty-free content -- so that
folder was declined outright and the library was built from a properly
licensed source instead.

- **Source**: incompetech.com (Kevin MacLeod), CC-BY 4.0 -- explicitly
  permits commercial use, modification, and redistribution, with
  attribution as the only condition. Ten tracks were curated across
  moods relevant to product-training/onboarding video (upbeat, ambient,
  playful, corporate/waiting, motivational, curious), verified downloadable
  and confirmed under the catalog's blanket CC-BY 4.0 terms. Bundled at
  `resources/music-library/` (flat `.mp3` files + `manifest.json` +
  `ATTRIBUTIONS.md`), ~52MB total -- picked up automatically by the
  existing `extraResources` config.
- **Attribution handling**: unlike the sound effects (which needed no
  attribution), CC-BY requires it. Each manifest entry carries an
  `attribution` string in the exact format incompetech's FAQ specifies;
  it's shown under every track in the Music Library screen and copied
  into the imported Asset's `notes` field so the credit travels with the
  asset even after import.
- **New IPC** (`musicLibraryIpc.ts`): `music-library:list` /
  `music-library:import`, structurally identical to the Sound Library's
  handlers (same checksum-dedup import into the `music` asset category).
- **"Add Your Own Music"**: the Music Library screen also has a button
  that reuses the *existing*, already-proven `assets:choose-files` /
  `assets:import` IPC (the same generic file-picker-to-Asset-Library flow
  used elsewhere) so users with their own licensed tracks -- a music
  subscription, something they wrote, anything they hold the rights to --
  can add it straight into their project. This deliberately does not
  route through the bundled-library pipeline: user-supplied music is
  never copied into `resources/`, only into the user's own project.
- **Verified**: 156/156 tests still pass (no new automated tests were
  needed since both IPC handlers reuse code paths -- `buildAssetFromFile`
  + checksum dedup -- already covered by the Sound Library's tests and
  the pre-existing `assets:import` tests); `npx tsc --noEmit` clean for
  both apps/desktop configs; `npm run build -w apps/desktop` succeeds;
  the packaged app launches cleanly with the new Music Library nav item
  and route present.

## Font Library + fixed caption-burn-in fontfile, and an Icon Library

The last two "open license additions" from the creative-possibilities
list (background music was built first; a bundled offline LLM was
deliberately skipped as too large/heavy a commitment for now).

**Fonts** (`resources/fonts/`, ~6MB): six SIL Open Font License 1.1
(Google Fonts) families covering distinct visual styles -- Inter (general
sans), Poppins Regular+Bold (bold titles), JetBrains Mono (technical/code
content), Merriweather (editorial serif), Quicksand (friendly rounded),
Bebas Neue (condensed display) -- plus a `manifest.json` and each
family's `OFL-*.txt` license text. While wiring this in, a real latent
bug was found and fixed: `renderFinalExport.ts`'s caption burn-in used
ffmpeg's `drawtext` filter with no `fontfile=` specified, meaning it
depended entirely on fontconfig's undocumented default-font lookup --
not guaranteed to resolve to anything on a fresh Windows install. Added
`captionFontFilePath` to `RenderFinalExportOptions`, wired it through
`drawtext=fontfile='<escaped path>':...` (with Windows-path escaping:
backslashes to forward slashes, then the drive-letter colon escaped), and
`exportIpc.ts` now passes `getDefaultCaptionFontPath()` (bundled Inter)
by default. A new real-ffmpeg test
(`renderFinalExport.test.ts`: "renders captions using an explicit bundled
font file without erroring") exercises this against the actual bundled
`Inter.ttf`. The rest of the font manifest is metadata-only for now --
no UI to pick a non-default caption font or apply bundled fonts to
overlay text yet, tracked in KNOWN_LIMITATIONS.md.

**Icons** (`resources/icons/`, ~45KB): 30 curated MIT-licensed Feather
Icons SVGs (check, x, arrows, play/pause, info/alert/help callouts,
star/thumbs-up/award, settings, user/users, bar-chart, target, flag,
book, clipboard, download/upload, mail/phone/calendar/clock, lock/shield,
trending-up, zap) plus `manifest.json` (title + search tags) and Feather's
`LICENSE.txt`. New **Icon Library** screen (`/icon-library`, new nav
item) -- a searchable grid of `<img>` previews (rendered white via a CSS
`invert` filter, since Feather's `stroke="currentColor"` doesn't resolve
inside an `<img>` document context) with multi-select import into the
Asset Library's `graphics` category, mirroring the Sound/Music Library's
list/import IPC pattern exactly (`iconLibraryIpc.ts`,
`getIconsDir()` in `resourcePaths.ts`).

**Verified**: 157/157 tests pass (including the new real-ffmpeg
`captionFontFilePath` test); `npx tsc --noEmit` clean for both
apps/desktop configs; `npm run build -w apps/desktop` succeeds; the
packaged app launches cleanly with both new nav items and routes present.
