import { useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import type { KnowledgeSource } from "@aether/shared-types";

const STATUS_OPTIONS = ["unreviewed", "verified", "partially-verified", "outdated", "conflicting", "archived"];

const STATUS_COLORS: Record<string, string> = {
  unreviewed: "bg-hairline/10 text-silver",
  verified: "bg-emerald-500/15 text-emerald-300",
  "partially-verified": "bg-bronze/20 text-bronze",
  outdated: "bg-red-500/15 text-red-300",
  conflicting: "bg-red-500/25 text-red-200",
  archived: "bg-hairline/5 text-silver/60",
};

export function KnowledgeLibrary(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const isSaving = useAppStore((s) => s.isSaving);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!currentManifest) return <NoProjectOpen what="knowledge sources" />;

  const sources = currentManifest.knowledgeSources;
  const filtered = useMemo(
    () =>
      sources.filter(
        (s) =>
          s.title.toLowerCase().includes(filter.toLowerCase()) ||
          (s.bodyText ?? "").toLowerCase().includes(filter.toLowerCase()),
      ),
    [sources, filter],
  );
  const selected = sources.find((s) => s.id === selectedId) ?? null;

  async function addSource() {
    const timestamp = nowIso();
    const source: KnowledgeSource = {
      id: generateId("source"),
      title: "New Source",
      sourceType: "pasted-text",
      addedAt: timestamp,
      status: "unreviewed",
      verifiedClaims: [],
      prohibitedClaims: [],
    };
    await updateAndSave((m) => ({ ...m, knowledgeSources: [...m.knowledgeSources, source] }));
    setSelectedId(source.id);
  }

  async function updateSource(id: string, patch: Partial<KnowledgeSource>) {
    await updateAndSave((m) => ({
      ...m,
      knowledgeSources: m.knowledgeSources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  async function removeSource(id: string) {
    await updateAndSave((m) => ({ ...m, knowledgeSources: m.knowledgeSources.filter((s) => s.id !== id) }));
    setSelectedId(null);
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Knowledge Library</h1>
            <p className="text-sm text-silver">Verified product information used to keep scripts accurate.</p>
          </div>
          <button
            type="button"
            onClick={addSource}
            className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5"
          >
            + Add Source
          </button>
        </header>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search sources..."
          className="mb-4 w-full max-w-sm rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
        />

        <div className="flex gap-6">
          <div className="w-72 flex-shrink-0 space-y-2">
            {filtered.length === 0 && <p className="text-sm text-silver">No sources match.</p>}
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  s.id === selected?.id ? "border-electric-blue bg-electric-blue/10" : "border-hairline/10 hover:border-hairline/30"
                }`}
              >
                <p className="text-cream">{s.title}</p>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${STATUS_COLORS[s.status] ?? ""}`}>
                  {s.status}
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="flex-1 space-y-4 rounded-lg border border-hairline/10 bg-charcoal p-5">
              <div className="flex items-center justify-between">
                <input
                  value={selected.title}
                  onChange={(e) => updateSource(selected.id, { title: e.target.value })}
                  className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSource(selected.id)}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-silver">Source Type</label>
                  <input
                    value={selected.sourceType}
                    onChange={(e) => updateSource(selected.id, { sourceType: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Status</label>
                  <select
                    value={selected.status}
                    onChange={(e) => updateSource(selected.id, { status: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Product Version</label>
                  <input
                    value={selected.productVersion ?? ""}
                    onChange={(e) => updateSource(selected.id, { productVersion: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Original Location</label>
                  <input
                    value={selected.originalLocation ?? ""}
                    onChange={(e) => updateSource(selected.id, { originalLocation: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-silver">Content</label>
                <textarea
                  value={selected.bodyText ?? ""}
                  onChange={(e) => updateSource(selected.id, { bodyText: e.target.value })}
                  rows={8}
                  className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-silver">Notes</label>
                <textarea
                  value={selected.notes ?? ""}
                  onChange={(e) => updateSource(selected.id, { notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
              </div>

              {(selected.status === "outdated" || selected.status === "conflicting") && (
                <div className="rounded-md border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-300">
                  This source is marked {selected.status}. Scripts citing it should be reviewed.
                </div>
              )}
              {isSaving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or add a knowledge source.</p>
          )}
        </div>
      </main>
    </div>
  );
}
