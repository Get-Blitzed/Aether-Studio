# Roadmap

Phases 1 (Foundation), 2 (Preproduction), 3 (Media Management), 4
(Audio and Screen Capture), 5 (Timeline and Graphics), 6 (AI Providers),
7 (Review and Export), and 8 (Document-to-Video, Voice, Redaction, and UI
Redesign) are complete -- see IMPLEMENTATION_STATUS.md. Phase 8's actual
scope was set by an explicit user request that superseded the original
spec-section-42 "Polish and Packaging" plan for that slot; that original
plan now runs as Phase 9 below, still not started.

## Phase 2 -- Preproduction: COMPLETE

Series & Curriculum Planner (global, DB-backed, with the editable sample
Orbit Mission 001-010 curriculum), Brand Studio, Character Studio
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

## Phase 4 -- Audio and Screen Capture: COMPLETE

Voice Studio (profiles, takes, real FFmpeg trim/normalize/denoise/
remove-silence/merge/export), Screen Capture Studio (privacy checklist,
`desktopCapturer` source picker, `MediaRecorder`-based recording with
mic/best-effort-system-audio, post-capture trim/speed via the same FFmpeg
layer). Voice cloning was not built at all (not just deferred) -- the spec
explicitly says it must not be required, and no cloning means no
consent/rights-warning screen is needed yet.

**Deferred out of Phase 4, moved later:**
- Live interactive verification of the actual recording flow (click
  Start, record, Stop, confirm the asset appears) -- verified instead via
  headless checks of the same underlying functions (`desktopCapturer`,
  `buildAssetFromFile`, the audio processing pipeline) after GUI automation
  in this environment risked interacting with unrelated windows. See
  IMPLEMENTATION_STATUS.md's Phase 4 notes.
- Click-indicator/keystroke-display overlays and cursor highlighting during
  capture -- these need either OS-level input hooks (a native-module risk
  similar to the one avoided in Phase 1) or compositing work better suited
  to Phase 5's overlay system. Not attempted.
- Callouts, step labels, freeze-frame, region blur -- explicitly deferred;
  trim and speed adjustment are the only post-capture tools built.
- A pronunciation *dictionary* (per-word overrides) -- `pronunciationNotes`
  is a free-text field on `VoiceProfile`, not a structured word list.

## Phase 5 -- Timeline and Graphics: COMPLETE

Timeline/track/clip/marker schemas and overlay/caption schemas
(`@aether/shared-types`), `concatVideoClips()` quick-preview-render function
(`@aether/media-engine`, alongside Phase 3/4's other FFmpeg operations --
no separate `packages/timeline-engine` was needed, see
IMPLEMENTATION_STATUS.md's architecture note), the Timeline Editor screen
(multitrack add/remove, numeric-control clip placement, mute/solo/lock,
shared playback clock with drift-corrected video/audio elements, overlay/
caption preview rendering, undo/redo, Quick Preview Render), and the
Caption Studio screen (generate-from-script, manual edit, warnings,
hand-written SRT/VTT export/import).

**Deferred out of Phase 5, moved later:**
- Mouse drag-based clip placement/trim/move on the timeline -- clips are
  positioned via numeric Start/Duration/Source-In fields instead, a
  deliberate choice given this environment's demonstrated GUI-automation
  coordinate issues (Phase 4), not a technical blocker to building it later.
- A dedicated Audio Mixer screen -- audio tracks (narration/music/
  sound-effects) live inside the Timeline Editor's track list with per-track
  mute/solo/volume already, but there's no separate mixing-console view with
  level meters yet.
- Real-time frame-accurate broadcast sync -- the playback clock is a
  wall-clock `requestAnimationFrame` loop with periodic drift correction
  (media elements re-seek if they drift >0.3s from the expected position),
  not a frame-locked scheduler. Adequate for a preview editor, not for
  frame-accurate output.
- Full project-level export encoding -- `concatVideoClips()` produces a
  video-only quick preview at a fixed default resolution (1280x720); it is
  explicitly not the delivery export pipeline, which is Phase 7's job.
- Click indicators, transition effects between clips, and keyframe-based
  animation on overlays -- overlays currently support only fixed position +
  a single entry animation (fade/slide), no keyframing.

## Phase 6 -- AI Providers: COMPLETE

`packages/ai-providers` (provider interface, `MockProvider` with real
deterministic text templates and ffmpeg-rendered placeholder images,
`OpenAiCompatibleProvider` and `GenericRestProvider` real `fetch`-based
adapters, offline-mode gate), `packages/plugin-sdk` (manifest schema +
validator, no runtime loader yet), Electron `safeStorage`-based secret
storage (DPAPI-backed, no native credential-manager module), the Provider &
Plugin Manager screen (CRUD, test connection, usage/cost estimate
surfacing via a background-jobs list), and AI-assist wiring into Script
Studio (Generate Outline, Improve Hook) and Storyboard Studio (Generate
Frame Image). Offline mode (a Settings field since Phase 1) now actually
gates every provider call that isn't the mock kind.

**Deferred out of Phase 6, moved later:**
- No real network provider has been exercised end-to-end -- there are no
  API credentials available in this development environment.
  `OpenAiCompatibleProvider`/`GenericRestProvider` are real HTTP clients,
  not stubs, but only their config-validation paths are tested.
- Per-project provider gating -- the manifest's `providerReferences: string[]`
  field (present since Phase 1, always empty) was not wired up; every
  enabled global provider is available to every project.
- A real plugin loader -- `packages/plugin-sdk` defines and validates the
  manifest contract a plugin must satisfy, but there is no mechanism to
  discover, load, or execute third-party plugin code yet (a real security
  surface deliberately not opened this phase).
- AI-assist actions beyond the three wired this phase (generate storyboard
  image, generate outline, improve hook) -- e.g. generate/critique prompts
  in Prompt Workshop, suggest character bios, auto-tag knowledge sources --
  are not built; the provider layer supports them, but adding UI buttons
  for every action named across the spec would be its own multi-session
  effort.
- A visible per-job progress bar / cancel button -- jobs run synchronously
  from the renderer's perspective (the mock provider completes in
  well under a second; a real network call could take much longer) and are
  only recorded, not streamed, to the Recent Jobs list.

## Phase 7 -- Review and Export: COMPLETE

`packages/export-engine` (pure `runQualityChecklist()`, real ffmpeg
`renderFinalExport()` with audio mixing and caption burn-in, real
`archiveProduction()` zip via `adm-zip`), four built-in export presets
(the social-media version generator, in effect -- a vertical and a square
preset alongside the two 16:9 ones), the Export Center screen (checklist +
render + archive + past-exports list), and the Review & Approval screen
(inline approval-status editing and reviewer notes across every scene and
storyboard frame, with the same checklist summary).

**Deferred out of Phase 7, moved later:**
- Export presets are a fixed built-in list, not a user-editable/CRUD
  screen -- matches the Phase 6 precedent for AI provider presets not
  needing their own management UI to be useful.
- Overlay/graphics/title track compositing is not part of the final
  export -- `renderFinalExport()` composites the primary video track,
  audio tracks, and captions, same scope boundary Phase 5's preview
  render already had; secondary-video, character-animation, and
  screen-capture tracks are likewise not composited.
- No per-job export progress bar -- a render blocks the Export Center's
  "Export Now" button until ffmpeg finishes, the same synchronous-from-the-
  renderer's-perspective model Phase 6's AI jobs use.
- No choice of *where* an archive or export is saved -- both always land
  in a fixed subfolder (`renders/`, `archives/`) inside the project
  directory, matching the existing `backups/`/`cache/` convention rather
  than adding a save-location dialog.

## Phase 8 -- Document-to-Video, Voice, Redaction, and UI Redesign: COMPLETE

`packages/document-engine` (PDF/DOCX/PPTX text extraction, slide-card
rendering, script/storyboard auto-generation), a document-import wizard
that converts any of those file types (or a plain video/audio file) into a
full timeline in one step; a native Windows voice (SAPI) provider as the
default offline TTS tier plus an untested-live ElevenLabs provider as the
external tier, wired into Voice Studio and the document-import pipeline for
automatic narration; a "blur" timeline track type with percentage-based
redaction regions composited into `renderFinalExport()`; an app-wide UI
redesign (brighter palette, rounder/circular shape language, an original
circles-and-ellipses logo) and a synthesized voice intro on the Splash
screen. See IMPLEMENTATION_STATUS.md for full detail.

**Deferred out of Phase 8, moved later:**
- The Timeline Editor's "Quick Preview Render" (`concatVideoClips()`) still
  doesn't composite captions or blur regions -- same scope boundary it's
  had since Phase 5; only `renderFinalExport()` (the real delivery export)
  composites blur.
- ElevenLabs support is implemented against the documented API shape but
  has not been exercised against a live account -- no credentials are
  available in this environment (same posture Phase 6 shipped with for
  `OpenAiCompatibleProvider`).
- The UI redesign re-themes the existing color/shape tokens and hand-picks
  a few high-visibility screens (Splash, Home, NavSidebar, Voice Studio,
  Document Import, Timeline Editor's blur controls) rather than
  individually restyling all ~20 screens -- the retheme cascades
  everywhere via Tailwind config, but per-screen bespoke layout tweaks
  were not done everywhere.

## Phase 9 -- Polish and Packaging
`packages/template-engine`, Learning Center, accessibility pass, performance
pass, the real Windows installer build (`electron-builder.yml` already
exists and produces a working NSIS installer shape -- Phase 9 is about
signing, icons, update architecture, and the release checklist), regression
tests.

## Explicitly deferred (per spec section 44)

Cloud collaboration, real-time multiuser editing, a commercial template
marketplace, mobile/browser-only builds, full color grading, 3D rigging,
real-time motion capture, node-based compositing, direct multi-platform
publishing, proprietary model training, enterprise license management.
