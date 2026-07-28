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
| `trimAudio()` | `ffmpeg -i <in> -ss <start> -to <end> <out>` (re-encoded, not `-c copy`, for sample-accurate cuts) | Throws `TRIM_FAILED` |
| `normalizeLoudness()` | `ffmpeg -i <in> -af loudnorm=I=<target>:TP=-1.5:LRA=11 <out>` | Throws `NORMALIZE_FAILED` |
| `denoiseAudio()` | `ffmpeg -i <in> -af afftdn <out>` | Throws `DENOISE_FAILED` |
| `removeSilence()` | `ffmpeg -i <in> -af silenceremove=... <out>` | Throws `SILENCE_REMOVAL_FAILED` |
| `mergeAudioTakes()` | `ffmpeg -i <a> -i <b> ... -filter_complex "[0:a][1:a]...concat=n=N:v=0:a=1[out]" -map [out] <out>` | Throws `MERGE_FAILED` (including a pre-check: fewer than 2 inputs) |
| `convertAudioFormat()` | `ffmpeg -i <in> -c:a pcm_s16le\|libmp3lame <out>` | Throws `CONVERT_FAILED` |
| `analyzeLoudness()` | `ffmpeg -i <in> -af ebur128=peak=true -f null -`, parses the **final** `Summary:` block of stderr | Throws `LOUDNESS_ANALYSIS_FAILED`; see the parsing-bug note below |
| `trimVideo()` | `ffmpeg -i <in> -ss <start> -to <end> -c:v libx264 -c:a aac <out>` | Throws `VIDEO_TRIM_FAILED` |
| `adjustVideoSpeed()` | `ffmpeg -i <in> -filter_complex "[0:v]setpts=(1/f)*PTS[v];[0:a]atempo=f[a]" -map [v] -map [a] <out>` (f clamped to 0.5-2.0, `atempo`'s single-stage range) | Throws `VIDEO_SPEED_FAILED` |
| `concatVideoClips()` | Single invocation, all segments as inputs: one `filter_complex` chain per segment (`trim=start=..:end=..,setpts=PTS-STARTPTS,scale=<w>:<h>:force_original_aspect_ratio=decrease,pad=<w>:<h>:(ow-iw)/2:(oh-ih)/2,setsar=1`, default 1280x720) so mismatched source resolutions don't break the join, then `concat=n=N:v=1:a=0` -- video-only, no audio track | Throws `VIDEO_TRIM_FAILED` (including a pre-check: empty segment list) |
| `renderFinalExport()` (`@aether/export-engine`) | Single invocation: the same per-segment trim/scale/pad/concat as `concatVideoClips()` but parameterized by an export preset's resolution/frame rate, chained through a `drawtext` filter per caption (`enable='between(t\,start\,end)'` time-windows, commas escaped since the filtergraph itself is comma-delimited) for burn-in, plus every narration/music/sound-effect clip trimmed (`atrim`), volume/faded (`afade`), delayed to its timeline position (`adelay=<ms>:all=1`), and mixed (`amix=inputs=N:duration=first`) into one audio stream muxed with the video (`-c:v libx264 -c:a aac`) | Throws `RENDER_FAILED` (including a pre-check: empty video segment list -> `NO_VIDEO_SEGMENTS`) |
| `archiveProduction()` (`@aether/export-engine`) | Not ffmpeg -- zips a project folder via `adm-zip`, excluding the regenerable `cache/` folder and any prior `archives/` entries | Throws `ARCHIVE_FAILED` |

All of these were exercised in `packages/media-engine/src/mediaEngine.test.ts`,
`audioVideoProcessing.test.ts`, and `packages/export-engine/src/renderFinalExport.test.ts`/
`archiveProduction.test.ts` against **real** ffmpeg-generated test video/audio
(via `-f lavfi` `testsrc`/`sine`/`anullsrc` sources, so the tests need no
checked-in binary media fixtures) and a real zip archive -- not mocked.

### A real bug this caught: loudness-progress-line vs. Summary-block parsing

`analyzeLoudness()` originally matched the first `I: ... LUFS` occurrence
anywhere in ffmpeg's stderr. The `ebur128` filter prints a progress line
roughly every 100ms *while measuring* (each containing that same `I:`
pattern), then a final `Summary:` block with the converged value once
measurement completes. Matching the first occurrence grabbed an early,
unstable transient reading -- a plain 3-second tone (genuinely around -22
LUFS) was reported as -70 LUFS, which would have made a "normalize to -16
LUFS" action look like it silently did nothing to a `VoiceTake`'s recorded
metadata. Fixed by locating the last `Summary:` marker in stderr and
parsing only the text after it. Caught during Phase 4 manual verification
of the Voice Studio pipeline, not by the original (too-loose) automated
test -- the regression test added afterward asserts both a plausible
loudness range and that normalization measurably moves the reading, so a
similar regression can't pass silently again.

### Caption burn-in reuses the same drawtext approach as Phase 6's mock image labels

`renderFinalExport()`'s caption burn-in and Phase 6's `MockProvider.generateImage()`
both burn text onto video/image frames via ffmpeg's `drawtext` filter rather
than the `subtitles` filter (which needs libass and a real `.srt`/`.ass`
file on disk). Chaining one `drawtext` per caption directly in the
filtergraph, each gated by its own `enable='between(t,start,end)'` window,
avoids a round-trip through a subtitle file and keeps caption timing
expressed in the same seconds-based units as everything else in the
timeline data model. The one wrinkle: `between(t,start,end)`'s commas have
to be escaped (`between(t\,start\,end)`) because the surrounding
filtergraph syntax also uses commas to separate a filter's own options --
an unescaped comma would be parsed as ending the `enable=` value early.

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

- Delivery export (`renderFinalExport()`, Phase 7) composites the primary
  video track, audio tracks, and captions, but not the graphics/titles/
  overlays tracks -- those aren't burned into the final export, only shown
  live in the Timeline Editor's preview. Secondary-video, character-
  animation, and screen-capture tracks also aren't composited.
- No proxy (lower-resolution preview) generation.
- No progress reporting for long-running ffmpeg operations -- everything
  Phases 3-4 do completes in a few seconds per file even for short
  narration/demo clips. A real background job system with progress/cancel
  is a later-phase concern once operations (like export encoding) are slow
  enough to need one.
- Video processing (`trimVideo`, `adjustVideoSpeed`) always re-encodes with
  `libx264`/`aac`, discarding the original codec/bitrate. Fine for a demo
  clip; not appropriate for a delivery-quality export pipeline.
