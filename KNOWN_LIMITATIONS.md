# Known Limitations (Phase 1-3)

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

## FFmpeg is integrated, but only for metadata/preview, not encoding

As of Phase 3, FFmpeg is real and working (see FFMPEG_INTEGRATION.md) --
probing, single-frame thumbnail extraction, and waveform image generation
all run against the actual bundled binary. What's still missing: any actual
video **encoding** or transcoding. The "output format," "aspect ratio," and
"frame rate" fields on a production's settings are stored but not yet acted
on by anything -- that's Phase 5 (timeline render) and Phase 7 (export).

## No AI provider code at all

Zero network calls exist in this codebase. "Offline mode" exists as a
Settings toggle because the schema was designed for Phase 6 up front, but it
currently has nothing to disable.

## Nav sidebar still lists some modules that don't work yet

As of Phase 3, Series, Knowledge, Scripts, Storyboards, Prompts, Characters,
Brands, and Assets are real, working screens. Timeline, Voice, Animation,
Screen Capture, Audio, Captions, Review, Export, Templates, Providers, and
Learning Center remain disabled buttons with a tooltip naming the phase they
arrive in. This is deliberate (see ARCHITECTURE.md), not an oversight.

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

## UI automation of the Electron window is unreliable in this environment

Verifying the app's GUI in this session required OS-level screenshotting and
synthetic mouse/keyboard events (there's no browser-based preview for a
native Electron window). Mouse-coordinate clicks were flaky here due to a
window-position/DPI mismatch between screenshots; keyboard navigation
(Tab/Shift+Tab/Space) proved reliable and was used for the final verified
run. Native OS dialogs (the file-open picker) needed their own top-level
window handle found via `EnumWindows` and targeted directly with
`SetForegroundWindow` -- sending keys to the main window's handle while a
native dialog was open let the keystrokes go to whatever window actually
had focus instead (see IMPLEMENTATION_STATUS.md's Phase 3 notes). This is a
limitation of the verification environment, not of the app.
