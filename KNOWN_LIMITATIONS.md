# Known Limitations (Phase 1-6)

## Database engine: sql.js, not better-sqlite3

The spec says "use SQLite." We use SQLite -- via **sql.js** (SQLite compiled
to WebAssembly) instead of the more common **better-sqlite3** native addon.

**Why:** `better-sqlite3` requires compiling a native Node addon via
node-gyp, which in turn requires MSVC Build Tools with the "Desktop
development with C++" workload. On the machine this was built on, that
toolchain isn't installed, and `npm install` failed outright (node-gyp could
not find a usable Visual Studio installation). Rather than require every
future contributor or user's build machine to install a multi-gigabyte C++
toolchain just to run `npm install`, the database layer was built against
sql.js, which has no native dependency at all.

**Practical effect:** the whole database is held in memory and the full file
is rewritten to disk after every mutating call
(`packages/database/src/sqlJsAdapter.ts`). This is invisible at the current
scale (a few hundred rows of project/settings/activity metadata) but would
need revisiting if the app ever tracked, say, millions of activity-log rows
without pruning. `ARCHITECTURE.md` documents the swap-back path if a build
toolchain becomes available and native performance matters.

## FFmpeg is integrated for metadata/preview and now real editing, but not full encoding/export

As of Phase 4, FFmpeg does real work beyond metadata: audio trim/normalize/
denoise/silence-removal/merge/format-conversion, and video trim/speed
adjustment, in addition to Phase 3's probing and thumbnail/waveform
generation (see FFMPEG_INTEGRATION.md). What's still missing: full
project-level video **encoding**/rendering or transcoding for delivery. The
"output format," "aspect ratio," and "frame rate" fields on a production's
settings are stored but not yet acted on by anything -- that's Phase 5
(timeline render) and Phase 7 (export).

## Voice cloning is not built, by design

The spec requires that voice cloning never be a required workflow, and
Aether Studio Suite currently has no voice-generation provider integration
at all (that's Phase 6). `VoiceProfile`'s provider/model fields are
informational text only. If cloning is ever added, it must ship with an
explicit consent/rights-warning screen per the spec -- not optional, and
not yet designed.

## Screen Capture's recording flow was not interactively verified via clicking

Mouse-driven GUI verification in this session accidentally landed a click on
an unrelated window on the tester's real desktop (see IMPLEMENTATION_STATUS.md's
Phase 4 notes for the root cause and fix). Rather than continue clicking
blindly, the actual recording flow (`desktopCapturer` + `getUserMedia` +
`MediaRecorder`) was verified piece-by-piece headlessly instead: a minimal
standalone Electron script confirmed `desktopCapturer.getSources()` returns
real sources with valid thumbnails, and the save/asset-registration path was
verified via the same `buildAssetFromFile` function Phase 3 already proved
out. The `MediaRecorder` recording itself -- clicking Start, letting it run,
clicking Stop, and confirming a working video lands in the Asset Library --
was not exercised end-to-end. It follows Electron's standard documented
pattern for this exact use case, but hasn't been proven by an actual
recording yet.

## No click indicators, keystroke display, or cursor highlighting during capture

These require either OS-level global input hooks (a native-module
dependency risk of the same kind avoided for the database in Phase 1) or
compositing better suited to Phase 5's overlay system. Not attempted.
Similarly, callouts, step labels, freeze-frame, and region-blur post-capture
tools are not built -- only trim and speed adjustment are.

## System audio capture during screen recording is best-effort only

Screen Capture Studio's "System audio" toggle attempts Chromium's
`chromeMediaSource: 'desktop'` audio capture, which is not reliably
supported across all Windows configurations. If it fails, recording
silently falls back to video-only (plus microphone, if enabled) --
surfaced to the user via the saved recording's notes field, not a
blocking error.

## No real AI provider has been exercised end-to-end

`OpenAiCompatibleProvider` and `GenericRestProvider` (Phase 6) are real
`fetch`-based HTTP clients, not stubs, and offline mode now genuinely gates
every call either of them would make -- but there are no API credentials
available in this development environment, so neither has actually talked
to a live server. Only their config-validation error paths (missing API
key, missing base URL) are unit-tested. The `MockProvider` is fully
exercised (including its real ffmpeg-rendered image output), since it's
the only provider kind designed to need no credentials at all.

## AI-assist actions are wired into three buttons, not every screen

Script Studio (Generate Outline, Improve Hook) and Storyboard Studio
(Generate Frame Image) call into the Phase 6 provider layer; Prompt
Workshop, Character Studio, Knowledge Library, and other screens named in
the spec as candidates for AI assistance do not have equivalent buttons
yet. The provider layer itself is generic (any screen could call
`window.aether.providers.runJob()` with its own job type and structured
prompt), so adding more is a UI-wiring exercise per screen, not a new
architecture.

## Providers are global, not gated per project

`ProviderConfig` records live in the app database (like series plans),
not inside any single project's `project.aether`. The manifest's
`providerReferences: string[]` field (present since Phase 1, always empty)
was designed for a project to opt into a subset of configured providers,
but that gating was not implemented this phase -- every enabled provider
is available to every open project.

## No real plugin loader

`packages/plugin-sdk` defines and validates the manifest shape a plugin
must have (id, version, capabilities, entry point) but there is no code to
discover, load, sandbox, or execute a third-party plugin's actual logic.
This is deliberate -- loading and running arbitrary third-party code is a
significant security surface that deserves its own design pass, not
something to open casually while building the provider abstraction it
would eventually plug into.

## Nav sidebar still lists some modules that don't work yet

As of Phase 6, Series, Knowledge, Scripts, Storyboards, Prompts, Characters,
Brands, Assets, Voice, Screen Capture, Timeline, Audio, Captions, and
Providers are real, working screens. Animation, Review, Export, Templates,
and Learning Center remain disabled buttons with a tooltip naming the phase
they arrive in (or, for Animation, no scheduled phase yet). This is
deliberate (see ARCHITECTURE.md), not an oversight.

## Asset Library has no video playback or proxy generation

The Asset Library itself still shows only a static thumbnail frame for
video assets (and a waveform image for audio) -- not an actual playable
preview in the grid. Real transport controls (play/pause/scrub) now exist,
but only inside the Timeline Editor's preview player, which is scoped to
clips placed on a timeline rather than to browsing the library directly.

## Timeline playback is a wall-clock preview, not frame-accurate

The Timeline Editor's playback clock is a `requestAnimationFrame` loop that
advances the playhead by wall-clock delta time; the preview `<video>` and
each audio track's `<audio>` element follow it with periodic drift
correction (re-seeking if they drift more than 0.3s from the expected
position) rather than the media elements themselves driving a frame-locked
clock. This is adequate for previewing edit decisions but is not
frame-accurate broadcast sync, and "Quick Preview Render" (via
`concatVideoClips()`) is a fixed-resolution (default 1280x720), video-only
quick render for confirming an edit -- not the delivery export pipeline,
which is Phase 7's job.

## Timeline clip editing is numeric-only, not drag-and-drop

Clips are added, trimmed, and repositioned via numeric Start/Duration/
Source-In fields in the Clip Inspector, not by dragging on the timeline
canvas. This was a deliberate choice for Phase 5, made explicitly because of
this environment's demonstrated GUI-automation coordinate-mapping issues
(see the note below and Phase 4's entry) -- numeric controls are reliably
testable with keyboard input, whereas drag gestures would inherit the same
coordinate risk already documented. It is not a technical limitation of the
timeline data model, which supports arbitrary clip positions.

## No dedicated Audio Mixer screen yet

Narration/music/sound-effects tracks live inside the Timeline Editor's track
list with per-track mute/solo and per-clip volume already wired up, but
there is no separate mixing-console view (level meters, master bus, etc.).
The "Audio" nav item intentionally routes to the Timeline Editor rather than
a stub screen.

## Script/Storyboard/Prompt views are partial

Script Studio only implements the full-script segment-card view -- not the
outline, treatment, two-column audiovisual, or teleprompter views from spec
section 12. None of the AI-assisted script actions (generate outline,
improve hook, estimate duration via AI, etc.) exist; duration/word-count
math is deterministic local calculation, not AI-assisted. Storyboard Studio
has grid and scene-list views but not the animatic, contact-sheet, or
presentation views. Prompt Workshop stores and assembles prompts as text but
has no connection to an actual image/video generation provider (there are
none yet -- see Phase 6).

## No migration exercised beyond format version 1

`ProjectManifestSchema`'s version-mismatch guard is in place and will refuse
to open a manifest from a newer format version, but no actual field-mapping
migration logic exists yet because there has only ever been one manifest
version.

## No installer has been produced

`electron-builder.yml` is configured (appId, product name, NSIS target,
extraResources for `/resources`) but `npm run dist:win` has not been run in
this session -- Phase 1 verification used `electron-vite build` +
`electron .` directly, not a packaged installer. No app icon (`.ico`) has
been supplied yet, either -- electron-builder will fall back to its own
default icon until one is added under `apps/desktop/build/`.

## UI automation of the Electron window required care in this environment

Verifying the app's GUI required OS-level screenshotting and synthetic
mouse/keyboard events (there's no browser-based preview for a native
Electron window), on a real, cluttered, multi-window desktop. Two distinct
issues came up across phases, both now understood and fixed:

- **Native OS dialogs** (the file-open picker) needed their own top-level
  window handle, found via `EnumWindows` and targeted directly with
  `SetForegroundWindow` -- sending keys to the main window's handle while a
  dialog was open let keystrokes go to whatever window actually had focus
  instead (Phase 3).
- **`System.Windows.Forms.Cursor.Position` does not match
  `GetWindowRect`/`GetCursorPos`'s coordinate space** on this machine --
  confirmed by setting a position via `Cursor.Position` and reading it back
  via the raw Win32 `GetCursorPos`, which reported a different, non-uniform
  offset. This caused a click meant for the app to land on an unrelated
  window on the tester's real desktop during Phase 4 verification. Fix:
  use the raw Win32 `SetCursorPos` function instead of WinForms'
  `Cursor.Position` for all coordinate-based clicks; confirmed to align
  exactly with `GetCursorPos`/`GetWindowRect` afterward. Keyboard navigation
  (Tab/Shift+Tab/Space) remains unaffected by either issue and is preferred
  wherever it reaches the target, per Phase 1-2's findings.

This is a limitation of the verification environment, not of the app --
but it's worth a future session's time to read before doing more GUI
automation here, to avoid repeating the same failure mode.

- **Focus does not persist between separate tool invocations** (found in
  Phase 5): even with the `SetCursorPos` fix above, a click can land on the
  wrong window if `SetForegroundWindow` isn't called again *immediately*
  before that specific click -- something else can reclaim the foreground
  in between separate automation calls. Fix: re-assert
  `ShowWindow`/`SetForegroundWindow` on the target window's handle right
  before every click, not just once at the start of a sequence. A few clicks
  still intermittently missed (registering as a text-selection drag instead
  of a click) even with this in place; retrying once resolved all of them.
  Opening Chromium DevTools (`Ctrl+Shift+I`) and checking whether a button's
  own text changed (e.g. to "Rendering...") was a more reliable way to
  confirm a click actually registered than screenshots alone.
- **A single Alt-key press before `SetForegroundWindow` made it noticeably
  more reliable** (found in Phase 6): Windows enforces a "foreground lock"
  that can silently ignore `SetForegroundWindow` calls from a background
  process, and confirming the actual foreground window via
  `GetForegroundWindow()` sometimes showed this session's own Claude desktop
  app still in front even after the call. Sending a bare Alt keypress
  (`SendKeys::SendWait("%")`) immediately before `ShowWindow`/
  `SetForegroundWindow` is a well-known workaround for this specific Windows
  behavior and resolved it when a plain `SetForegroundWindow` call alone did
  not. Even so, one screen region proved persistently unreachable this phase
  (see IMPLEMENTATION_STATUS.md's Phase 6 notes on the offline-mode gate) --
  when a specific coordinate keeps failing after several refocus retries, it
  is often faster to rely on the equivalent unit test than to keep fighting
  the click.
