# Roadmap

Phase 1 (Foundation) is complete -- see IMPLEMENTATION_STATUS.md. The phases
below follow the spec's own phasing (section 42) and are not started.

## Phase 2 -- Preproduction
Production Hub (full fields: stages, views, warnings, activity feed), Series
& Curriculum Planner (with the sample A.I. Blitz Mission 001-010 curriculum),
Brand Studio (validation rules, override-with-note), Character Studio (full
reference gallery, consistency locks UI, version comparison), Knowledge
Library (source ingestion + citation linking), Script Studio (outline /
treatment / two-column / teleprompter views, AI-assist actions), Storyboard
Studio, Prompt Workshop.

## Phase 3 -- Media Management
`packages/media-engine`, Asset Library, media import + metadata, thumbnails,
waveforms, video preview, proxy generation, missing-media detection, the
FFmpeg service layer (isolated behind a typed interface, never raw shell
strings built ad hoc in UI code).

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
