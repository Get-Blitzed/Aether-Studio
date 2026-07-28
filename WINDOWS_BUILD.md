# Windows Build

## Development

```bash
npm install
npm run dev
```

## Production bundle (unpackaged)

```bash
cd apps/desktop
npx electron-vite build
npx electron .
```

This produces `apps/desktop/out/{main,preload,renderer}` and runs the app
directly from those files -- useful for verifying a production build without
going through the installer.

## Windows installer

```bash
cd apps/desktop
npm run dist:win
```

This runs `electron-vite build` followed by `electron-builder --win`, using
`apps/desktop/electron-builder.yml`:

- App id: `com.aetherstudiosuite.desktop`
- Product name: `Aether Studio Suite`
- Output: `Aether-Studio-Setup.exe`-style NSIS installer in `/release`
- `/resources` (branding, sample projects, templates) is copied in as
  `extraResources`, so the packaged app resolves the A.I. Blitz sample data
  the same way dev mode does (`getBundledResourcesDir()` in
  `apps/desktop/src/main/resourcePaths.ts` branches on `app.isPackaged`)

`npm run dist:win` has been run end-to-end and produces a real, working
`Aether-Studio-Suite-Setup.exe` (~214MB) in `/release`. One config fix was
needed to get there: npm workspaces hoist `electron` to the repo root's
`node_modules`, which electron-builder's own version auto-detection doesn't
look in (it only checks the local package) -- fixed by pinning
`electronVersion` explicitly in `apps/desktop/electron-builder.yml` to
match the installed Electron version.

**Not yet done, tracked in KNOWN_LIMITATIONS.md:** no `.ico` app icon has
been supplied (`apps/desktop/build/` is empty), so electron-builder uses its
own placeholder icon. See [MAC_BUILD.md](MAC_BUILD.md) for the macOS build
(requires an actual Mac or the GitHub Actions workflow in
`.github/workflows/build-installers.yml` -- it cannot be cross-compiled
from Windows).

## Requirements

- Node.js 20+, npm 10+
- No native build toolchain is required as of Phase 1 (see ARCHITECTURE.md's
  sql.js decision) -- `npm install` should succeed on a clean Windows
  machine with just Node and npm.
