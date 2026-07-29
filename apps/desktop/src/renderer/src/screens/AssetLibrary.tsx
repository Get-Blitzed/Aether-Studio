import { useEffect, useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { TagListEditor } from "../components/TagListEditor";
import { useAppStore } from "../state/appStore";
import { toFileUrl } from "../lib/fileUrl";
import { ASSET_CATEGORIES, previewKindForFileName, formatFileSize } from "../lib/assetPreview";
import type { Asset, AssetCategory } from "@aether/shared-types";

export function AssetLibrary(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | AssetCategory>("all");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importCategory, setImportCategory] = useState<AssetCategory>("images");
  const [importStorageMode, setImportStorageMode] = useState<"managed" | "linked">("managed");
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (currentProjectDir) {
      window.aether.assets.checkMissing(currentProjectDir).then((res) => {
        if (res.ok) setMissingIds(new Set(res.missingIds));
      });
    }
  }, [currentProjectDir, currentManifest?.assets.length]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="assets" />;

  const assets = currentManifest.assets;
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (favoritesOnly && !a.isFavorite) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = a.originalFileName.toLowerCase().includes(q);
        const matchesTag = a.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesTag) return false;
      }
      return true;
    });
  }, [assets, categoryFilter, favoritesOnly, search]);

  const selected = assets.find((a) => a.id === selectedId) ?? null;

  async function handleImport() {
    const filePaths = await window.aether.assets.chooseFiles();
    if (!filePaths) return;
    setImporting(true);
    setImportNotice(null);
    const result = await window.aether.assets.import({
      projectDir: currentProjectDir!,
      filePaths,
      category: importCategory,
      storageMode: importStorageMode,
    });
    setImporting(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`Imported ${result.added} asset${result.added === 1 ? "" : "s"}.`);
      if (result.duplicates.length > 0) {
        parts.push(
          `Skipped ${result.duplicates.length} duplicate${result.duplicates.length === 1 ? "" : "s"} already in the library: ${result.duplicates.map((d) => d.fileName).join(", ")}.`,
        );
      }
      setImportNotice(parts.join(" "));
    } else {
      setError(result.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  async function updateAsset(assetId: string, patch: Partial<Asset>) {
    const result = await window.aether.assets.updateMetadata(currentProjectDir!, assetId, patch);
    if (result.ok) setCurrentProject(currentProjectDir!, result.manifest);
    else setError(result.error ?? { title: "Update failed", detail: "Unknown error" });
  }

  async function handleRemove(assetId: string) {
    const result = await window.aether.assets.remove(currentProjectDir!, assetId);
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
      setSelectedId(null);
    } else {
      setError(result.error ?? { title: "Remove failed", detail: "Unknown error" });
    }
  }

  async function handleRelink(assetId: string) {
    const result = await window.aether.assets.relink(currentProjectDir!, assetId);
    if (result.canceled) return;
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
      setMissingIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    } else {
      setError(result.error ?? { title: "Relink failed", detail: "Unknown error" });
    }
  }

  async function handleReveal(assetId: string) {
    const result = await window.aether.assets.reveal(currentProjectDir!, assetId);
    if (!result.ok) setError(result.error ?? { title: "Could not open folder", detail: "Unknown error" });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Asset Library</h1>
            <p className="text-sm text-silver">Images, video, audio, and documents for {currentManifest.title}.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-silver">
              Category
              <select
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value as AssetCategory)}
                className="mt-1 block rounded-md border border-hairline/10 bg-charcoal px-2 py-1.5 text-sm text-cream"
              >
                {ASSET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-silver">
              Storage
              <select
                value={importStorageMode}
                onChange={(e) => setImportStorageMode(e.target.value as "managed" | "linked")}
                className="mt-1 block rounded-md border border-hairline/10 bg-charcoal px-2 py-1.5 text-sm text-cream"
              >
                <option value="managed">Copy into project</option>
                <option value="linked">Link to original</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import Files..."}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {importNotice && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {importNotice}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "all" | AssetCategory)}
            className="rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream"
          >
            <option value="all">All categories</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/-/g, " ")}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or tag..."
            className="w-56 rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-silver">
            <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
            Favorites only
          </label>
          <span className="text-xs text-silver">{filtered.length} of {assets.length} assets</span>
        </div>

        <div className="flex gap-6">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" style={{ alignContent: "start" }}>
            {filtered.length === 0 && (
              <p className="col-span-full text-sm text-silver">
                {assets.length === 0 ? "No assets yet. Import files to get started." : "No assets match the current filter."}
              </p>
            )}
            {filtered.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                projectDir={currentProjectDir}
                isMissing={missingIds.has(asset.id)}
                isSelected={asset.id === selectedId}
                onClick={() => setSelectedId(asset.id)}
              />
            ))}
          </div>

          {selected && (
            <aside className="w-80 flex-shrink-0 space-y-4 rounded-lg border border-hairline/10 bg-charcoal p-4">
              <div className="flex items-start justify-between">
                <p className="break-all font-medium text-cream">{selected.originalFileName}</p>
                <button type="button" onClick={() => setSelectedId(null)} className="text-silver hover:text-cream">
                  ×
                </button>
              </div>

              {missingIds.has(selected.id) && (
                <div className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                  File not found at its recorded location.
                  <button
                    type="button"
                    onClick={() => handleRelink(selected.id)}
                    className="ml-2 underline hover:text-red-100"
                  >
                    Relink...
                  </button>
                </div>
              )}

              <div className="space-y-1 text-xs text-silver">
                <p>Category: <span className="text-cream">{selected.category.replace(/-/g, " ")}</span></p>
                <p>Storage: <span className="text-cream">{selected.storageMode === "managed" ? "Copied into project" : "Linked to original"}</span></p>
                <p>Size: <span className="text-cream">{formatFileSize(selected.fileSizeBytes)}</span></p>
                {selected.durationSeconds !== undefined && (
                  <p>Duration: <span className="text-cream">{selected.durationSeconds.toFixed(1)}s</span></p>
                )}
                {selected.width && selected.height && (
                  <p>Dimensions: <span className="text-cream">{selected.width}x{selected.height}</span></p>
                )}
                {selected.checksumSha256 && (
                  <p>Checksum: <span className="font-mono text-cream">{selected.checksumSha256.slice(0, 16)}...</span></p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-silver">
                <input
                  type="checkbox"
                  checked={selected.isFavorite}
                  onChange={(e) => updateAsset(selected.id, { isFavorite: e.target.checked })}
                />
                Favorite
              </label>

              <TagListEditor label="Tags" values={selected.tags} onChange={(v) => updateAsset(selected.id, { tags: v })} />
              <TagListEditor
                label="Collections"
                values={selected.collections}
                onChange={(v) => updateAsset(selected.id, { collections: v })}
              />

              <div>
                <label className="mb-1 block text-xs text-silver">Source Attribution / License Notes</label>
                <textarea
                  value={selected.sourceAttribution ?? ""}
                  onChange={(e) => updateAsset(selected.id, { sourceAttribution: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleReveal(selected.id)}
                  className="rounded-md border border-hairline/20 px-3 py-1.5 text-xs text-cream hover:bg-hairline/5"
                >
                  Reveal in Folder
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(selected.id)}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Remove from Library
                </button>
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function AssetCard({
  asset,
  projectDir,
  isMissing,
  isSelected,
  onClick,
}: {
  asset: Asset;
  projectDir: string;
  isMissing: boolean;
  isSelected: boolean;
  onClick: () => void;
}): JSX.Element {
  const kind = previewKindForFileName(asset.originalFileName);
  const absoluteFileUrl =
    asset.storageMode === "managed" ? toFileUrl(projectDir, asset.filePath) : toFileUrl("", asset.filePath);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-2 text-left ${isSelected ? "border-electric-blue bg-electric-blue/10" : "border-hairline/10 bg-charcoal hover:border-hairline/30"}`}
    >
      <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded bg-navy">
        {isMissing ? (
          <span className="text-xs text-red-300">Missing file</span>
        ) : kind === "image" ? (
          <img src={absoluteFileUrl} alt={asset.originalFileName} className="h-full w-full object-cover" />
        ) : kind === "video" && asset.thumbnailPath ? (
          <img src={toFileUrl(projectDir, asset.thumbnailPath)} alt={asset.originalFileName} className="h-full w-full object-cover" />
        ) : kind === "audio" && asset.waveformImagePath ? (
          <img src={toFileUrl(projectDir, asset.waveformImagePath)} alt={asset.originalFileName} className="h-full w-full object-contain" />
        ) : (
          <span className="text-2xl text-silver/40">{kind === "video" ? "🎬" : kind === "audio" ? "🎵" : "📄"}</span>
        )}
      </div>
      <p className="truncate text-xs text-cream">{asset.originalFileName}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-silver">{asset.category.replace(/-/g, " ")}</span>
        {asset.isFavorite && <span className="text-xs text-bronze">★</span>}
        {isMissing && <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">missing</span>}
      </div>
    </button>
  );
}
