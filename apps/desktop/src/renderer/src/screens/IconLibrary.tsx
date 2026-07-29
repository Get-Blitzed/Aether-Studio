import { useEffect, useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { toAbsoluteFileUrl } from "../lib/fileUrl";

interface IconLibraryEntry {
  id: string;
  title: string;
  tags: string[];
  absolutePath: string;
}

export function IconLibrary(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);

  const [entries, setEntries] = useState<IconLibraryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.aether.iconLibrary.list().then((result) => {
      if (result.ok) setEntries(result.entries);
      else setError(result.error ?? { title: "Could not load Icon Library", detail: "Unknown error" });
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => e.title.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)));
  }, [entries, search]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="the icon library" />;

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
    const result = await window.aether.iconLibrary.import({
      projectDir: currentProjectDir,
      entryIds: [...selectedIds],
    });
    setImporting(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      const parts: string[] = [];
      if (result.added > 0) parts.push(`Added ${result.added} icon${result.added === 1 ? "" : "s"} to the Asset Library.`);
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
            <h1 className="text-2xl font-semibold text-cream">Icon Library</h1>
            <p className="text-sm text-silver">
              {entries.length} bundled MIT-licensed icons (Feather Icons) for overlays, annotations, and storyboard
              graphics. Nothing is copied until you pick it.
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or tag..."
            className="w-56 rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
          />
          <span className="text-xs text-silver">
            {filtered.length} of {entries.length} icons
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {filtered.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => toggleSelected(entry.id)}
              title={entry.title}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 ${
                selectedIds.has(entry.id) ? "border-electric-blue bg-electric-blue/10" : "border-white/10 bg-charcoal"
              }`}
            >
              <img src={toAbsoluteFileUrl(entry.absolutePath)} alt={entry.title} className="h-8 w-8 invert" />
              <span className="w-full truncate text-center text-[10px] text-silver">{entry.title}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="col-span-full text-sm text-silver">No icons match the current search.</p>}
        </div>
      </main>
    </div>
  );
}
