# Roadmap

Phases 1 (Foundation), 2 (Preproduction), and 3 (Media Management) are
complete -- see IMPLEMENTATION_STATUS.md. The phases below follow the
spec's own phasing (section 42) and are not started.

## Phase 2 -- Preproduction: COMPLETE

Series & Curriculum Planner (global, DB-backed, with the editable sample
A.I. Blitz Mission 001-010 curriculum), Brand Studio, Character Studio
(reference gallery + consistency locks), Knowledge Library, Script Studio
(scene/segment editor with real duration math), Storyboard Studio, Prompt
Workshop -- all built and manually verified against the running app.

**Deferred out of Phase 2, moved later:**
- Production Hub's fuller view set (Kanban/calendar/dashboard views,
  activity feed, pending-tasks/warnings surfacing) -- the current Production
  Overview screen covers the core fields and cross-links but not every view
  mode from spec section 7. Revisit alongside Phase 7's review workflow,
  since "warnings" overlaps with the Quality-Control Engine.
- Script Studio's outline/treatment/two-column/teleprompter *views* -- only
  the full-script segment-card view is built. The AI-assist actions (generate
  outline, improve hook, etc.) explicitly wait for Phase 6's provider layer.
- Character version comparison (side-by-side diffing of reference sets) --
  `versionHistory` exists on the schema but has no UI yet.
- Knowledge Library's citation-linking UI (script segments already store
  `sourceCitationIds`, but there's no picker to attach them from either
  screen yet).

## Phase 3 -- Media Management: COMPLETE

`packages/media-engine` (real FFmpeg via `ffmpeg-static`/`ffprobe-static`:
checksum, probe, video thumbnail, audio waveform image), Asset Library
(import with copy/link modes, duplicate detection, missing-file detection
and relink, tags/collections/favorites), FFmpeg status surfaced in
Settings. See FFMPEG_INTEGRATION.md for the full design.

**Deferred out of Phase 3, moved later:**
- Video **preview playback** in the Asset Library (an actual `<video>`
  scrubber) -- current preview is a static thumbnail frame only.
- Proxy (lower-resolution) generation for smoother timeline editing --
  waits until Phase 5 actually has a timeline to serve proxies to.
- A background-job queue with progress/cancel UI -- not needed yet because
  every Phase 3 operation (checksum, probe, single-frame extraction)
  completes in well under a second per file; revisit once Phase 5/7 export
  operations are slow enough to need one.
- Asset versioning (spec section 15 mentions it) -- no UI or schema support
  yet beyond the single current file per asset.

## Phase 4 -- Audio and Screen Capture
Voice Studio (takes, trim, normalize), Screen Capture Studio (privacy
checklist, post-capture tools). Voice cloning, if ever added, requires an
explicit consent/rights-warning screen per the spec -- not optional.

## Phase 5 -- Timeline and Graphics
`packages/timeline-engine`, multitrack editor, overlays/titles/captions,
audio mixer, render preview via the Phase 3 FFmpeg layer.

## Phase 6 -- AI Providers
`packages/ai-providers`, `packages/plugin-sdk`, Windows credential-store
integration for secrets, mock providers for tests, OpenAI-compatible +
generic REST adapters, background job queue, usage/cost estimate surfacing.
Offline mode (already a Settings field in Phase 1) must actually gate every
network call once there is a network call to gate.

## Phase 7 -- Review and Export
`packages/export-engine`, review/approval workflow, the full Quality-Control
Engine checklist, export presets, production archive ZIP, social-media
version generator.

## Phase 8 -- Polish and Packaging
`packages/template-engine`, Learning Center, accessibility pass, performance
pass, the real Windows installer build (`electron-builder.yml` already
exists and produces a working NSIS installer shape -- Phase 8 is about
signing, icons, update architecture, and the release checklist), regression
tests.

## Explicitly deferred (per spec section 44)

Cloud collaboration, real-time multiuser editing, a commercial template
marketplace, mobile/browser-only builds, full color grading, 3D rigging,
real-time motion capture, node-based compositing, direct multi-platform
publishing, proprietary model training, enterprise license management.
