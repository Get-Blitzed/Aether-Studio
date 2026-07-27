# Known Limitations (Phase 1-2)

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

## No FFmpeg yet

Nothing in Phase 1 touches media, so there's no FFmpeg integration to speak
of. The "output format," "aspect ratio," and "frame rate" fields on a
production's settings are stored but not yet acted on by anything.

## No AI provider code at all

Zero network calls exist in this codebase. "Offline mode" exists as a
Settings toggle because the schema was designed for Phase 6 up front, but it
currently has nothing to disable.

## Nav sidebar still lists some modules that don't work yet

As of Phase 2, Series, Knowledge, Scripts, Storyboards, Prompts, Characters,
and Brands are real, working screens. Timeline, Assets, Voice, Animation,
Screen Capture, Audio, Captions, Review, Export, Templates, Providers, and
Learning Center remain disabled buttons with a tooltip naming the phase they
arrive in. This is deliberate (see ARCHITECTURE.md), not an oversight.

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
run. This is a limitation of the verification environment, not of the app.
