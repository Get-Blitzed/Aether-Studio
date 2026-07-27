# Testing

## Automated tests

```bash
npm test
```

Runs vitest (`vitest.config.ts` at the repo root) over
`packages/*/src/**/*.test.ts`. Current coverage (23 tests):

- **`packages/core/src/paths.test.ts`** -- filename sanitization (reserved
  characters, Windows device names, trailing dots/spaces, empty input) and
  `AETHER_APPDATA_OVERRIDE` / `AETHER_DOCUMENTS_OVERRIDE` env-var honoring.
- **`packages/database/src/db.test.ts`** -- migrations create the expected
  tables, migrations don't re-apply, settings/projects/activity-log
  repositories round-trip correctly, the sql.js-backed database persists
  across close/reopen.
- **`packages/project-engine/src/project.test.ts`** -- full project
  scaffold + manifest creation, title sanitization into a safe folder name,
  refusal to reuse a non-empty folder, save/reload round trip, structured
  errors for missing/corrupt manifests, backup rotation and restore.

`apps/desktop` (Electron main/preload/renderer) has no automated tests yet --
Phase 1 verification for it was manual (see IMPLEMENTATION_STATUS.md).
Adding renderer component tests and a main-process integration test harness
is tracked for a later phase.

## Manual acceptance checklist (Phase 1 subset)

The full spec (section 40) lists 20 acceptance tests spanning every phase.
The ones applicable to Phase 1 were run manually this checkpoint:

1. ✅ Install and launch on Windows (`npm install`, `electron-vite build`, `electron .`)
2. ✅ Create a new production
3. ✅ Save and reopen the production
4. ✅ Load the A.I. Blitz sample project
5. ✅ Import the Blitz character sheet (auto-import path, confirmed on disk)
6. Create or edit the Blitz character profile -- *partially*: the sample
   seeds a complete profile; in-place editing isn't built until Character
   Studio (Phase 2)
7-16. Script/storyboard/voiceover/screen-capture/timeline/overlay/caption/QC/export
   steps are not applicable yet (Phases 2-7)
17. ✅ Reopen the production without missing references (confirmed via the
    "Recent Productions" list and re-reading the manifest)
18. ✅ Recover after a simulated abnormal shutdown (the `running.lock` marker
    correctly persisted across a `taskkill /F` and triggered the splash
    screen's safe-mode notice on next launch)
19. ✅ Operate in offline mode -- the Settings toggle exists and persists;
    there is no network code yet for it to actually gate (see
    KNOWN_LIMITATIONS.md)
20. Not applicable yet -- no provider adapters exist until Phase 6

## Adding tests for new packages

Any new `packages/<name>/src/**/*.test.ts` file is picked up automatically
by the root `vitest.config.ts` glob -- no per-package test config is needed.
Use `beforeEach`/`afterEach` with `os.tmpdir()`-based paths (see the existing
tests) rather than touching real `%APPDATA%` or `Documents` paths.
