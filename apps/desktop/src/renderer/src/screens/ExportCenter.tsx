import { useEffect, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import type { QualityCheck } from "@aether/shared-types";

interface ExportPresetOption {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
}

const STATUS_STYLES: Record<QualityCheck["status"], string> = {
  pass: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-bronze/15 text-bronze",
  fail: "bg-red-500/15 text-red-300",
};

export function ExportCenter(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const [presets, setPresets] = useState<ExportPresetOption[]>([]);
  const [presetId, setPresetId] = useState<string>("");
  const [timelineId, setTimelineId] = useState<string>("");
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    window.aether.export.listPresets().then((list) => {
      setPresets(list);
      if (list.length > 0) setPresetId((prev) => prev || list[0]!.id);
    });
  }, []);

  useEffect(() => {
    if (!currentManifest?.timelines.length) return;
    setTimelineId((prev) => prev || currentManifest.timelines[0]!.id);
  }, [currentManifest]);

  const refreshChecklist = async () => {
    if (!currentProjectDir) return;
    const result = await window.aether.export.runQualityChecklist(currentProjectDir);
    if (result.ok) setChecks(result.checks);
    else setError(result.error ?? { title: "Checklist failed", detail: "Unknown error" });
  };

  useEffect(() => {
    refreshChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectDir]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="export" />;

  const exportAssets = currentManifest.assets.filter((a) => a.category === "exports");

  async function handleExportNow() {
    if (!timelineId || !presetId) return;
    setExporting(true);
    setNotice(null);
    setError(null);
    const result = await window.aether.export.render({ projectDir: currentProjectDir!, timelineId, presetId });
    setExporting(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
      setNotice("Export rendered and added to the Asset Library (Exports category).");
      await refreshChecklist();
    } else {
      setError(result.error ?? { title: "Export failed", detail: "Unknown error" });
    }
  }

  async function handleCreateArchive() {
    setArchiving(true);
    setNotice(null);
    setError(null);
    const result = await window.aether.export.createArchive(currentProjectDir!);
    setArchiving(false);
    if (result.ok) {
      setNotice(`Production archive created: ${result.archivePath}`);
    } else {
      setError(result.error ?? { title: "Archive failed", detail: "Unknown error" });
    }
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-cream">Export Center</h1>
          <p className="text-sm text-silver">Render a delivery video, check production readiness, and create a backup archive.</p>
        </header>

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {notice && (
          <div className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">{notice}</div>
        )}

        <section className="mb-6 rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Quality-Control Checklist</h2>
          {checks.length === 0 ? (
            <p className="text-sm text-silver">Running checks...</p>
          ) : (
            <div className="space-y-2">
              {checks.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-sm">
                  <span className="text-cream">{c.label}</span>
                  <div className="flex items-center gap-2">
                    {c.detail && <span className="text-xs text-silver">{c.detail}</span>}
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-silver">
            These are informational, not blocking -- a failing check means something is likely missing, not that export is disabled.
          </p>
        </section>

        <section className="mb-6 rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Render Final Export</h2>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="text-xs text-silver">
              Timeline
              <select
                value={timelineId}
                onChange={(e) => setTimelineId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
              >
                {currentManifest.timelines.length === 0 && <option value="">No timelines yet</option>}
                {currentManifest.timelines.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-silver">
              Export Preset
              <select
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.width}x{p.height})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={handleExportNow}
            disabled={exporting || !timelineId || !presetId}
            className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
          >
            {exporting ? "Rendering..." : "Export Now"}
          </button>
        </section>

        <section className="mb-6 rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Production Archive</h2>
          <p className="mb-3 text-xs text-silver">
            Bundles the project's manifest, assets, and renders into a single .zip in the project's "archives" folder for backup or handoff.
          </p>
          <button
            type="button"
            onClick={handleCreateArchive}
            disabled={archiving}
            className="rounded-md border border-white/20 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
          >
            {archiving ? "Archiving..." : "Create Production Archive (.zip)"}
          </button>
        </section>

        <section className="rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Past Exports</h2>
          {exportAssets.length === 0 ? (
            <p className="text-sm text-silver">No exports rendered yet.</p>
          ) : (
            <div className="space-y-2">
              {exportAssets.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2 text-sm">
                  <span className="text-cream">{a.originalFileName}</span>
                  <span className="text-xs text-silver">{a.notes ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
