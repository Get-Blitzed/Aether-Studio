import { useEffect, useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { toAbsoluteFileUrl } from "../lib/fileUrl";

interface SoundLibraryEntry {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  absolutePath: string;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  return `${seconds.toFixed(1)}s`;
}

export function SoundLibrary(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);

  const [entries, setEntries] = useState<SoundLibraryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.aether.soundLibrary.list().then((result) => {
      if (result.ok) setEntries(result.entries);
      else setError(result.error ?? { title: "Could not load Sound Library", detail: "Unknown error" });
    });
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) map.set(e.category, e.categoryLabel);
    return [...map.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [entries, categoryFilter, search]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="the sound library" />;

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
    const result = await window.aether.soundLibrary.import({
      projectDir: currentProjectDir,
      entryIds: [...selectedIds],
    });
    setImporting(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`Added ${result.added} sound effect${result.added === 1 ? "" : "s"} to the Asset Library.`);
      if (result.duplicates.length > 0) parts.push(`Skipped ${result.duplicates.length} already in the library.`);
      setNotice(parts.join(" "));
      setSelectedIds(new Set());
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
            <h1 className="text-2xl font-semibold text-cream">Sound Library</h1>
            <p className="text-sm text-silver">
              {entries.length} curated, royalty-free sound effects bundled with the app. Preview and add the ones you
              want to {currentManifest.title}'s Asset Library -- nothing is copied until you pick it.
            </p>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || selectedIds.size === 0}
            className="rounded-full bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
          >
            {importing ? "Adding..." : `Add ${selectedIds.size || ""} to Project`.trim()}
          </button>
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

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
          >
            <option value="all">All categories</option>
            {categories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-56 rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
          />
          <span className="text-xs text-silver">
            {filtered.length} of {entries.length} effects
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                selectedIds.has(entry.id) ? "border-electric-blue bg-electric-blue/10" : "border-white/10 bg-charcoal"
              }`}
            >
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
                  {entry.categoryLabel}
                  {entry.durationSeconds !== null ? ` · ${formatDuration(entry.durationSeconds)}` : ""}
                </p>
              </div>
              <audio controls src={toAbsoluteFileUrl(entry.absolutePath)} style={{ height: 28, width: 130 }} />
            </div>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-sm text-silver">No effects match the current filter.</p>}
        </div>
      </main>
    </div>
  );
}
