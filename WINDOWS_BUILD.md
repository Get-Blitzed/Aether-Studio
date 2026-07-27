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

**Not yet done, tracked in KNOWN_LIMITATIONS.md:** no `.ico` app icon has
been supplied (`apps/desktop/build/` is empty), so electron-builder will use
its own placeholder icon; and `npm run dist:win` has not actually been
executed end-to-end in this checkpoint (Phase 1 verification used the
unpackaged production bundle above instead).

## Requirements

- Node.js 20+, npm 10+
- No native build toolchain is required as of Phase 1 (see ARCHITECTURE.md's
  sql.js decision) -- `npm install` should succeed on a clean Windows
  machine with just Node and npm.
