# Aether Studio Suite

**From imagination to final cut.**
Plan it. Create it. Animate it. Deliver it.

Aether Studio Suite is a Windows desktop production system for animated
product-training videos, tutorials, onboarding lessons, marketing videos, and
branded instructional series. It combines production management, a
scriptwriting environment, storyboard planning, a character-consistency
manager, brand management, a prompt workshop, media asset management, and a
lightweight nonlinear timeline editor into one local-first application.

The included sample production -- **A.I. Blitz, Mission 001: Welcome to A.I.
Blitz** -- is a template, not a hard-coded special case. The application is
built to support other characters, brands, clients, and production types.

> **Status: Phases 1-8 complete** (Foundation; Preproduction; Media
> Management; Audio and Screen Capture; Timeline and Graphics; AI Providers;
> Review and Export; Document-to-Video/Voice/Redaction/UI Redesign). See
> [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for exactly what
> works today versus what's planned. Series planning, brand/character
> management, knowledge sources, scriptwriting, storyboarding, prompt
> authoring, the Asset Library, Voice Studio (real FFmpeg processing plus
> AI voice synthesis), Screen Capture Studio, a full multitrack Timeline
> Editor with blur/redaction, AI provider integration (mock/OpenAI-compatible/
> generic REST/native Windows voice/ElevenLabs), a real Quality-Control +
> Export + Archive pipeline, and a one-step Document Import wizard
> (PDF/DOCX/PPTX/video/audio -> a full narrated video project) are all real
> and working. Phase 9 (template system, Learning Center, accessibility/
> performance pass, signed installer) is not yet built -- this is a real,
> running application, not a mockup, at every stage.

## Quick start (development)

Requires Node.js 20+ and npm 10+ on Windows.

```bash
npm install
npm run dev
```

`npm run dev` launches the Electron app with the renderer running under Vite
HMR. On first run you'll see the onboarding wizard: start a blank production,
open the A.I. Blitz sample, or import an existing `.aether` project.

## Other useful commands

```bash
npm run typecheck   # strict TypeScript across every package
npm test            # vitest unit tests (148 tests across 22 test files)
npm run build        # build all workspace packages
```

To build a real Electron bundle without the dev server:

```bash
cd apps/desktop
npx electron-vite build
npx electron .        # launch the built app directly
```

See [WINDOWS_BUILD.md](WINDOWS_BUILD.md) for producing an actual
`Aether-Studio-Suite-Setup.exe` installer via electron-builder.

## Repository layout

```
/apps/desktop         Electron shell + React renderer
/packages/core        Logging, Windows-safe paths, ids
/packages/shared-types  Zod schemas shared by main and renderer
/packages/database    App-metadata database (SQLite via sql.js) + migrations
/packages/project-engine  The .aether project file format: create/save/load/backup
/packages/media-engine  FFmpeg-backed checksum/probe/thumbnail/waveform/video-processing service
/packages/ai-providers  Text/image/voice AI provider abstraction (mock, OpenAI-compatible, generic REST, native Windows voice, ElevenLabs)
/packages/plugin-sdk  Plugin manifest schema + validation (no runtime loader yet)
/packages/export-engine  Quality-Control checklist, real ffmpeg final export (with blur redaction), production archive zipping
/packages/document-engine  PDF/DOCX/PPTX text extraction, slide rendering, script/storyboard auto-generation
/resources            Branding, sample projects (A.I. Blitz), templates
/docs                 Architecture, format, and process documentation
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) -- system design and key decisions
- [PROJECT_FORMAT.md](PROJECT_FORMAT.md) -- the `.aether` project file format
- [FFMPEG_INTEGRATION.md](FFMPEG_INTEGRATION.md) -- the media-engine design and what FFmpeg is (and isn't) used for
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) -- what's built vs. planned
- [ROADMAP.md](ROADMAP.md) -- phase 9 and beyond
- [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) -- current gaps and workarounds
- [WINDOWS_BUILD.md](WINDOWS_BUILD.md) -- producing a Windows installer
- [MAC_BUILD.md](MAC_BUILD.md) -- producing a macOS installer (requires a Mac or CI)
- [TESTING.md](TESTING.md) -- how to run and extend the test suite
