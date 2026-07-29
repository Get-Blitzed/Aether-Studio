import { useEffect, useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { toAbsoluteFileUrl } from "../lib/fileUrl";

interface MusicLibraryEntry {
  id: string;
  title: string;
  mood: string;
  moodLabel: string;
  durationSeconds: number | null;
  attribution: string;
  absolutePath: string;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MusicLibrary(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);

  const [entries, setEntries] = useState<MusicLibraryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [addingOwn, setAddingOwn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.aether.musicLibrary.list().then((result) => {
      if (result.ok) setEntries(result.entries);
      else setError(result.error ?? { title: "Could not load Music Library", detail: "Unknown error" });
    });
  }, []);

  const moods = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.mood, e.moodLabel);
    return [...map.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (moodFilter !== "all" && e.mood !== moodFilter) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, moodFilter, search]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="the music library" />;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selectedIds.size === 0 || !currentProjectDir) return;
    setImporting(true);
    setNotice(null);
    const result = await window.aether.musicLibrary.import({
      projectDir: currentProjectDir,
      entryIds: [...selectedIds],
    });
    setImporting(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`Added ${result.added} track${result.added === 1 ? "" : "s"} to the Asset Library.`);
      if (result.duplicates.length > 0) parts.push(`Skipped ${result.duplicates.length} already in the library.`);
      setNotice(parts.join(" "));
      setSelectedIds(new Set());
    } else {
      setError(result.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  async function handleAddOwnMusic() {
    if (!currentProjectDir) return;
    const filePaths = await window.aether.assets.chooseFiles();
    if (!filePaths || filePaths.length === 0) return;
    setAddingOwn(true);
    setNotice(null);
    const result = await window.aether.assets.import({
      projectDir: currentProjectDir,
      filePaths,
      category: "music",
      storageMode: "managed",
    });
    setAddingOwn(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`Added ${result.added} of your own track${result.added === 1 ? "" : "s"} to the Asset Library.`);
      if (result.duplicates.length > 0) parts.push(`Skipped ${result.duplicates.length} already in the library.`);
      setNotice(parts.join(" "));
    } else {
      setError(result.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Music Library</h1>
            <p className="text-sm text-silver">
              {entries.length} curated, CC-BY licensed background tracks bundled with the app (attribution required and
              handled automatically), plus your own music. Nothing is copied until you pick it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddOwnMusic}
              disabled={addingOwn}
              className="rounded-full border border-hairline/20 px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {addingOwn ? "Adding..." : "Add Your Own Music"}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selectedIds.size === 0}
              className="rounded-full bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
            >
              {importing ? "Adding..." : `Add ${selectedIds.size || ""} to Project`.trim()}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {notice}
          </div>
        )}

        <p className="mb-4 text-xs text-silver">
          Have your own royalty-free track, a licensed music-bed subscription, or something you have the rights to use?
          Use "Add Your Own Music" above to import it straight into this project's Asset Library -- it stays in your
          project only and is never bundled into the app itself.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={moodFilter}
            onChange={(e) => setMoodFilter(e.target.value)}
            className="rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream"
          >
            <option value="all">All moods</option>
            {moods.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-56 rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
          />
          <span className="text-xs text-silver">
            {filtered.length} of {entries.length} tracks
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 ${
                selectedIds.has(entry.id) ? "border-electric-blue bg-electric-blue/10" : "border-hairline/10 bg-charcoal"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  onChange={() => toggleSelected(entry.id)}
                  aria-label={`Select ${entry.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-cream" title={entry.title}>
                    {entry.title}
                  </p>
                  <p className="text-[10px] text-silver">
                    {entry.moodLabel}
                    {entry.durationSeconds !== null ? ` · ${formatDuration(entry.durationSeconds)}` : ""}
                  </p>
                </div>
                <audio controls src={toAbsoluteFileUrl(entry.absolutePath)} style={{ height: 28, width: 160 }} />
              </div>
              <p className="truncate text-[10px] text-silver/70" title={entry.attribution}>
                {entry.attribution}
              </p>
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-sm text-silver">No tracks match the current filter.</p>}
        </div>
      </main>
    </div>
  );
}
