# FFmpeg Integration

## Where it lives

All FFmpeg/ffprobe interaction is isolated in `packages/media-engine` --
nothing else in the codebase spawns a media-processing child process or
builds an FFmpeg command line directly. This matches the spec's requirement
to keep FFmpeg commands in a dedicated media-service layer.

## How the binaries are obtained

`ffmpeg-static` and `ffprobe-static` (npm packages that download a
prebuilt binary for the current platform/arch during `npm install`) are
direct dependencies of both `@aether/media-engine` and `apps/desktop` (the
latter so electron-vite's dependency scanner externalizes them correctly --
see ARCHITECTURE.md's note on bundled-workspace-package dependencies).
Confirmed working on this machine: FFmpeg 6.1.1-essentials (gyan.dev build)
with libx264/libvpx/libopus and friends, and a matching ffprobe.

`packages/media-engine/src/ffmpegLocator.ts` resolves which binary to use,
in order:
1. `Settings > Advanced > FFmpeg path` override, if set and the file exists.
2. The bundled `ffmpeg-static` binary.

If neither resolves to an existing file, functions that need FFmpeg throw a
`MediaEngineError` with an explicit code (`FFMPEG_NOT_FOUND`,
`FFPROBE_NOT_FOUND`) rather than crashing or silently producing incomplete
output -- callers (the Asset Library import flow) catch this and continue
without the derived metadata/preview rather than failing the whole import.

## What's actually implemented

| Function | Command shape | Failure mode |
|---|---|---|
| `probeMedia()` | `ffprobe -show_format -show_streams -of json <file>` | Throws `PROBE_FAILED` on a bad/corrupt file; caller skips duration/resolution metadata |
| `generateVideoThumbnail()` | `ffmpeg -ss <t> -i <in> -frames:v 1 -vf scale=<w>:-1 <out.jpg>` | Throws `THUMBNAIL_FAILED`; caller shows a generic icon instead |
| `generateWaveformImage()` | `ffmpeg -i <in> -filter_complex showwavespic=... -frames:v 1 <out.png>` | Throws `WAVEFORM_FAILED`; caller shows a generic icon instead |
| `checkFfmpegStatus()` | `ffmpeg -version` | Used by Settings' "Test FFmpeg" button |

All of these were exercised in `packages/media-engine/src/mediaEngine.test.ts`
against **real** ffmpeg-generated test video/audio (via `-f lavfi`
`testsrc`/`sine` sources, so the tests need no checked-in binary media
fixtures) -- not mocked.

## Security: no shell, no string interpolation

`runProcess()` (`packages/media-engine/src/runProcess.ts`) calls
`child_process.execFile(binaryPath, argsArray, ...)`. `execFile` never
spawns a shell, so arguments are passed to the binary directly regardless
of their content -- a filename containing spaces, quotes, `&&`, `;`, or any
other shell metacharacter cannot be reinterpreted as a second command. No
FFmpeg argument in this codebase is ever built via string concatenation or
template literals into a single command string.

## Packaging

`apps/desktop/electron-builder.yml` sets `asarUnpack` for both
`ffmpeg-static` and `ffprobe-static`'s `node_modules` trees, because a
binary inside an `asar` archive cannot be executed as a real OS process --
it needs to exist as a normal file on disk once packaged. This has not yet
been verified against an actual built installer (see KNOWN_LIMITATIONS.md --
`npm run dist:win` hasn't been run this checkpoint), only reasoned through;
verifying it is a Phase 8 packaging task.

## What's NOT implemented yet

- No actual video **encoding**/transcoding/export -- Phase 3 only reads
  metadata and extracts single frames/waveform images. Timeline rendering
  and export encoding are Phase 5/7.
- No proxy (lower-resolution preview) generation.
- No progress reporting for long-running ffmpeg operations -- everything
  Phase 3 does completes in well under a second per file. A real background
  job system with progress/cancel is a later-phase concern once operations
  (like export encoding) are slow enough to need one.
