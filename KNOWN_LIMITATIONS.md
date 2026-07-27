# Known Limitations (Phase 1-4)

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

## No AI provider code at all

Zero network calls exist in this codebase. "Offline mode" exists as a
Settings toggle because the schema was designed for Phase 6 up front, but it
currently has nothing to disable.

## Nav sidebar still lists some modules that don't work yet

As of Phase 4, Series, Knowledge, Scripts, Storyboards, Prompts, Characters,
Brands, Assets, Voice, and Screen Capture are real, working screens.
Timeline, Animation, Audio, Captions, Review, Export, Templates, Providers,
and Learning Center remain disabled buttons with a tooltip naming the phase
they arrive in. This is deliberate (see ARCHITECTURE.md), not an oversight.

## Asset Library has no video playback or proxy generation

The Asset Library shows a static thumbnail frame for video assets (and a
waveform image for audio), not an actual playable preview. Full transport
controls belong with Phase 5's timeline/preview work, where the same
playback surface will be reused rather than building a one-off video player
here first.

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
