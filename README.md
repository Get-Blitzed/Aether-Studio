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

> **Status: Phases 1 (Foundation), 2 (Preproduction), and 3 (Media
> Management) complete.** See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
> for exactly what works today versus what's planned. Series planning,
> brand/character management, knowledge sources, scriptwriting,
> storyboarding, prompt authoring, and the Asset Library (with a real FFmpeg
> integration for thumbnails/waveforms/metadata) are all real and working.
> Phases 4-8 (voice/screen capture, timeline, AI providers, review/export,
> polish) are not yet built -- this is a real, running application, not a
> mockup, at every stage.

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
npm test            # vitest unit tests (46 tests across 6 packages)
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
/packages/media-engine  FFmpeg-backed checksum/probe/thumbnail/waveform service
/resources            Branding, sample projects (A.I. Blitz), templates
/docs                 Architecture, format, and process documentation
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) -- system design and key decisions
- [PROJECT_FORMAT.md](PROJECT_FORMAT.md) -- the `.aether` project file format
- [FFMPEG_INTEGRATION.md](FFMPEG_INTEGRATION.md) -- the media-engine design and what FFmpeg is (and isn't) used for
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) -- what's built vs. planned
- [ROADMAP.md](ROADMAP.md) -- phases 4-8
- [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) -- current gaps and workarounds
- [WINDOWS_BUILD.md](WINDOWS_BUILD.md) -- producing a Windows installer
- [TESTING.md](TESTING.md) -- how to run and extend the test suite
