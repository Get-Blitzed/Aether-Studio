import { useMemo, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import { formatTimecode } from "../lib/timelineHelpers";
import { generateCaptionsFromScript, captionWarnings, findOverlappingCaptionIds } from "../lib/captionGeneration";
import type { Caption } from "@aether/shared-types";

export function CaptionStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scriptIdToGenerate, setScriptIdToGenerate] = useState("");

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="captions" />;

  const captions = useMemo(() => [...currentManifest.captions].sort((a, b) => a.startSeconds - b.startSeconds), [currentManifest.captions]);
  const overlapping = useMemo(() => findOverlappingCaptionIds(captions), [captions]);

  async function handleGenerate() {
    const script = currentManifest!.scripts.find((s) => s.id === scriptIdToGenerate);
    if (!script) return;
    const generated = generateCaptionsFromScript(script);
    await updateAndSave((m) => ({ ...m, captions: [...m.captions, ...generated] }));
    setNotice(`Generated ${generated.length} captions from "${script.title}".`);
  }

  async function handleAddManual() {
    const timestamp = nowIso();
    const last = captions[captions.length - 1];
    const start = last ? last.endSeconds : 0;
    const caption: Caption = {
      id: generateId("caption"),
      startSeconds: start,
      endSeconds: start + 3,
      text: "New caption",
      isSoundDescription: false,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, captions: [...m.captions, caption] }));
  }

  function updateCaption(id: string, patch: Partial<Caption>) {
    void updateAndSave((m) => ({
      ...m,
      captions: m.captions.map((c) => (c.id === id ? { ...c, ...patch, modifiedAt: nowIso() } : c)),
    }));
  }

  function removeCaption(id: string) {
    void updateAndSave((m) => ({ ...m, captions: m.captions.filter((c) => c.id !== id) }));
  }

  async function handleExport(format: "srt" | "vtt") {
    const result = await window.aether.captions.export({ projectDir: currentProjectDir!, format });
    if (result.ok) {
      setNotice(`Exported to ${result.exportedPath}`);
    } else if (!result.canceled) {
      setError(result.error ?? { title: "Export failed", detail: "Unknown error" });
    }
  }

  async function handleImport() {
    const result = await window.aether.captions.import(currentProjectDir!);
    if (result.canceled) return;
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
      setNotice(`Imported ${result.imported ?? 0} captions.`);
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
            <h1 className="text-2xl font-semibold text-cream">Caption Studio</h1>
            <p className="text-sm text-silver">Accessible captions for {currentManifest.title}.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-silver">
              Generate from script
              <select value={scriptIdToGenerate} onChange={(e) => setScriptIdToGenerate(e.target.value)} className="mt-1 block rounded-md border border-hairline/10 bg-charcoal px-2 py-1.5 text-sm text-cream">
                <option value="">Choose script...</option>
                {currentManifest.scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!scriptIdToGenerate} onClick={handleGenerate} className="rounded-md bg-electric-blue px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
              Generate
            </button>
            <button type="button" onClick={handleAddManual} className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5">
              + Add Caption
            </button>
            <button type="button" onClick={() => handleExport("srt")} className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5">
              Export SRT
            </button>
            <button type="button" onClick={() => handleExport("vtt")} className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5">
              Export VTT
            </button>
            <button type="button" onClick={handleImport} className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5">
              Import SRT/VTT
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{notice}</div>
        )}

        <div className="space-y-3">
          {captions.length === 0 && <p className="text-sm text-silver">No captions yet. Generate from a script or add one manually.</p>}
          {captions.map((caption) => {
            const warnings = captionWarnings(caption);
            const overlaps = overlapping.has(caption.id);
            return (
              <div key={caption.id} className={`rounded-lg border p-4 ${warnings.length > 0 || overlaps ? "border-bronze/50 bg-bronze/5" : "border-hairline/10 bg-charcoal"}`}>
                <div className="mb-2 flex items-center gap-3">
                  <label className="text-xs text-silver">
                    Start
                    <input type="number" step="0.1" value={caption.startSeconds} onChange={(e) => updateCaption(caption.id, { startSeconds: Number(e.target.value) })} className="ml-1 w-20 rounded border border-hairline/10 bg-navy px-2 py-1 text-cream" />
                  </label>
                  <label className="text-xs text-silver">
                    End
                    <input type="number" step="0.1" value={caption.endSeconds} onChange={(e) => updateCaption(caption.id, { endSeconds: Number(e.target.value) })} className="ml-1 w-20 rounded border border-hairline/10 bg-navy px-2 py-1 text-cream" />
                  </label>
                  <span className="text-xs text-silver">
                    {formatTimecode(caption.startSeconds)} → {formatTimecode(caption.endSeconds)}
                  </span>
                  <label className="ml-auto flex items-center gap-1 text-xs text-silver">
                    <input type="checkbox" checked={caption.isSoundDescription} onChange={(e) => updateCaption(caption.id, { isSoundDescription: e.target.checked })} />
                    Sound description
                  </label>
                  <button type="button" onClick={() => removeCaption(caption.id)} className="text-xs text-red-300 hover:text-red-100">
                    Remove
                  </button>
                </div>
                <textarea
                  value={caption.text}
                  onChange={(e) => updateCaption(caption.id, { text: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
                {(warnings.length > 0 || overlaps) && (
                  <ul className="mt-2 list-inside list-disc text-xs text-bronze">
                    {overlaps && <li>Overlaps with an adjacent caption.</li>}
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
