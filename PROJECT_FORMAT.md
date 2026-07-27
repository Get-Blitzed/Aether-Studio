# The .aether Project Format

## Layout

A production is a folder. Its name is a sanitized version of the production
title (Windows-reserved characters and device names like `CON`/`NUL` are
replaced; see `packages/core/src/paths.ts#sanitizeFileName`).

```
<Production Title>/
  project.aether        <- the manifest (see below)
  assets/
  proxies/
  renders/
  exports/
  cache/
  backups/              <- rotating project.aether snapshots
  scripts/
  storyboards/
  audio/
  video/
  images/
  captions/
  templates/
  logs/
  reviews/
  sources/
  characters/           <- character reference images (Phase 1 addition:
                            not in the original spec's subdirectory list,
                            added because Character Studio references need
                            a home before Phase 2's Asset Library exists)
```

`packages/project-engine/src/projectStructure.ts` is the single source of
truth for this list (`PROJECT_SUBDIRECTORIES`).

## The manifest (`project.aether`)

Plain JSON, versioned, validated against `ProjectManifestSchema` (Zod) in
`packages/shared-types/src/projectManifest.ts` on every read. Top-level
shape (Phase 1 fields -- more arrive with later phases per the schema's
existing but currently-empty arrays):

```ts
{
  formatVersion: number,        // currently 1
  applicationVersion: string,
  projectId: string,            // e.g. "proj_AbCdEf123456"
  title: string,
  description?: string,
  createdAt: string,             // ISO 8601
  modifiedAt: string,
  productionSettings: {
    clientName?, productName?, productionType, series?, episode?,
    targetAudience?, primaryObjective?, targetDurationSeconds?,
    outputFormat, aspectRatio, frameRate, dueDate?, stage, confidential,
  },
  brands: Brand[],
  characters: Character[],
  knowledgeSources: [],          // populated starting Phase 2
  scripts: Script[],
  tasks: [],                     // populated starting Phase 2
  providerReferences: [],        // opaque ids only -- never secrets
}
```

**Provider secrets are never written here.** `providerReferences` holds ids
that resolve against the OS credential store once Phase 6 (providers) adds
that store; the manifest itself is safe to zip up and hand to a client.

## Guarantees

- **Atomic writes.** `writeManifestAtomic()` serializes to
  `project.aether.tmp-<pid>-<timestamp>`, then `fs.renameSync`s it over
  `project.aether`. A crash mid-write leaves the previous valid manifest
  untouched, because the only step that touches the real filename is the
  rename.
- **Validated on read, not just on write.** `readManifest()` runs the parsed
  JSON through `ProjectManifestSchema.safeParse` and throws a structured
  `ProjectEngineError` (`MANIFEST_NOT_FOUND` / `MANIFEST_INVALID` /
  `MANIFEST_VERSION_UNSUPPORTED`) with a human-readable message rather than
  letting a malformed file crash the app.
- **Forward-compatible version check.** If `formatVersion` in the file is
  higher than the running app understands, the app refuses to open it with
  an explicit "update the application" error instead of silently
  misinterpreting newer fields.
- **Backups before every save.** `saveProject()` calls
  `createBackupSnapshot()` first (skipped only when there's no existing
  manifest yet, i.e. the very first save), which copies the current
  `project.aether` into `/backups/project.aether.<ISO-timestamp>.bak` and
  then deletes the oldest snapshots beyond the configured `backupCount`
  (default 10, from Settings) -- but only *after* the new snapshot is
  confirmed written, so a failure mid-rotation never leaves zero backups.
- **Never silently overwrite the only copy.** `createProject()` refuses to
  reuse an existing non-empty folder (`PROJECT_DIR_EXISTS` error) rather
  than merging into or wiping out whatever's already there.
- **Restore is itself reversible.** `restoreBackupSnapshot()` snapshots the
  *current* (about-to-be-replaced) manifest before copying the chosen backup
  over it, so restoring the wrong backup by mistake is not a dead end.

## What's not built yet

- No migration path has been exercised for `formatVersion` 2+ (there's only
  ever been version 1 so far); the version-check guard above is in place,
  but the actual field-by-field migration logic will be added the first
  time a Phase 2+ schema change requires it.
- No packaged "production archive ZIP" export yet (Phase 7).
