# macOS Build

## Why this can't be built from Windows

electron-builder's `dmg` target (and Apple code signing/notarization) both
require actual macOS tooling (`hdiutil`, `codesign`, `notarytool`) that
only exists on macOS itself -- there is no cross-compilation path from
Windows to a working, distributable `.dmg`. Two options:

1. **Build directly on a Mac** (below), or
2. **Use the GitHub Actions workflow already in this repo**
   (`.github/workflows/build-installers.yml`), which runs the Windows
   build on a `windows-latest` runner and the macOS build on a real
   `macos-latest` runner, so nobody needs to own a physical Mac.

Either way, `npm install` must run *on macOS* itself at least once, because
`ffmpeg-static`/`ffprobe-static` download the platform-specific ffmpeg
binary matching whatever OS/arch `npm install` runs on. The Windows
binaries already vendored into this repo's `node_modules` (from developing
on Windows) will not work in a macOS build -- macOS needs its own
`npm install`.

## Platform differences to know about

- **Native Windows voice synthesis (`SapiVoiceProvider`) is Windows-only.**
  On macOS it correctly reports itself unavailable (`testConnection()`
  returns `ok: false`, `listVoices()` returns `[]`) rather than crashing --
  the app runs fine, but the "native voice" tier of Voice Studio and the
  document-import auto-narration feature has nothing to offer on macOS
  unless an `ElevenLabsProvider` (or another external provider) is
  configured instead. A macOS-native TTS provider (via `say`/AVSpeechSynthesizer)
  is not implemented -- see KNOWN_LIMITATIONS.md.
- **ffmpeg/ffprobe**: `ffmpeg-static`/`ffprobe-static` publish real macOS
  (x64 and arm64) binaries, so media processing, export, and blur
  compositing all work identically to Windows once built on/for macOS.
- **sql.js, adm-zip, pdfjs-dist, mammoth**: all pure JS/WASM, no
  platform-specific behavior.

## Option A: build directly on a Mac

Requires a Mac with Node.js 20+ and npm 10+ (Xcode Command Line Tools
recommended, though no native compilation is required per the Phase 1
sql.js decision -- see ARCHITECTURE.md).

```bash
git clone <your-repo-url> aether-studio-suite
cd aether-studio-suite
npm install
npm run dist:mac -w apps/desktop
```

This runs `electron-vite build` followed by `electron-builder --mac` using
`apps/desktop/electron-builder.yml`'s `mac:` section (dmg target, x64 +
arm64). The unsigned `.dmg` lands in `/release`. Opening it on another Mac
will show Gatekeeper's "unidentified developer" warning (right-click ->
Open bypasses it) unless you sign + notarize (see below).

## Option B: build via GitHub Actions (no physical Mac needed)

1. Push this repo to GitHub (see the "New repository" steps below if you
   don't have one yet).
2. Push a tag matching `v*` (e.g. `git tag v0.2.0 && git push origin v0.2.0`),
   or trigger the workflow manually from the Actions tab
   ("Build installers" -> "Run workflow").
3. The workflow builds on `windows-latest`, `macos-latest`, and
   `ubuntu-latest` (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).

### How to verify you're looking at a fresh build

**Pushing commits to `master` alone never triggers this workflow** -- it
only runs on a pushed `v*` tag or a manual "Run workflow" click. This is
easy to miss: if you push a bunch of feature commits and then check the
Actions tab expecting a new build, you won't see one until you also cut a
new tag. To check whether a given commit actually has a build:

1. **Actions tab** (`Actions` -> "Build installers"): find the run whose
   commit SHA (shown under the run title) matches `git log -1 --format=%H`
   locally. If the newest run's SHA is older than your latest commit, no
   build has happened for your latest changes yet -- push a new tag.
2. **Releases page** (repo homepage -> `Releases`, or `/releases`): each
   tagged build publishes a real, permanent GitHub Release here (not just
   a 90-day workflow artifact) with the `.exe`/`.dmg`/`.AppImage` attached
   as release assets, one Release per tag, each showing its actual publish
   date -- the most reliable "is this current" check, since Releases don't
   expire the way run artifacts do.
3. **Tag-to-commit check**: `git log -1 --format=%H vX.Y.Z` shows exactly
   which commit a given tag (and therefore Release) was built from;
   compare that SHA against your latest commits.

## Signing and notarizing (optional, needed for real distribution)

Without signing, the dmg still works, but macOS Gatekeeper warns on first
launch and some users will not know how to bypass it. To ship a
"just works" dmg:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a **Developer ID Application** certificate in Xcode or the
   developer portal, export it as a `.p12` file with a password.
3. Create an **app-specific password** for your Apple ID
   (https://appleid.apple.com -> Sign-In and Security -> App-Specific Passwords).
4. Note your **Team ID** (developer portal -> Membership).
5. Set these as GitHub repository secrets (Settings -> Secrets and
   variables -> Actions) so the existing workflow picks them up
   automatically:
   - `MAC_CERTIFICATE_P12_BASE64` -- the `.p12` file, base64-encoded
     (`base64 -i cert.p12 | pbcopy` on macOS)
   - `MAC_CERTIFICATE_PASSWORD` -- the password you set exporting the `.p12`
   - `APPLE_ID` -- your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` -- from step 3
   - `APPLE_TEAM_ID` -- from step 4

electron-builder reads these via the `CSC_LINK`/`CSC_KEY_PASSWORD`/
`APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID` environment
variables (already wired into the workflow) and signs + notarizes
automatically when they're present; it silently produces an unsigned
build when they're absent, so nothing breaks if you skip this section.

## Not yet done

- No macOS app icon (`.icns`) has been supplied -- electron-builder falls
  back to its own placeholder, same as the Windows `.ico` gap noted in
  WINDOWS_BUILD.md.
- No macOS-native TTS provider -- see "Platform differences" above.
