import { useEffect, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { nowIso } from "../lib/ids";
import type { QualityCheck, Script, ScriptSegment, StoryboardFrame } from "@aether/shared-types";

const STATUS_STYLES: Record<QualityCheck["status"], string> = {
  pass: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-bronze/15 text-bronze",
  fail: "bg-red-500/15 text-red-300",
};

export function ReviewCenter(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const [checks, setChecks] = useState<QualityCheck[]>([]);

  useEffect(() => {
    if (!currentProjectDir) return;
    window.aether.export.runQualityChecklist(currentProjectDir).then((result) => {
      if (result.ok) setChecks(result.checks);
    });
  }, [currentProjectDir]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="review items" />;

  async function updateSegment(scriptId: string, segmentId: string, patch: Partial<ScriptSegment>) {
    await updateAndSave((m) => ({
      ...m,
      scripts: m.scripts.map((s) =>
        s.id === scriptId
          ? { ...s, segments: s.segments.map((seg) => (seg.id === segmentId ? { ...seg, ...patch } : seg)), modifiedAt: nowIso() }
          : s,
      ),
    }));
  }

  async function updateFrame(frameId: string, patch: Partial<StoryboardFrame>) {
    await updateAndSave((m) => ({
      ...m,
      storyboardFrames: m.storyboardFrames.map((f) => (f.id === frameId ? { ...f, ...patch, modifiedAt: nowIso() } : f)),
    }));
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-cream">Review &amp; Approval</h1>
          <p className="text-sm text-silver">Approve scenes and storyboard frames, and leave notes for the team before export.</p>
        </header>

        {checks.length > 0 && (
          <section className="mb-6 rounded-lg border border-hairline/10 bg-charcoal p-5">
            <h2 className="mb-3 font-medium text-cream">Quality-Control Summary</h2>
            <div className="flex flex-wrap gap-2">
              {checks.map((c) => (
                <span key={c.id} className={`rounded px-2 py-1 text-xs ${STATUS_STYLES[c.status]}`}>
                  {c.label}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mb-6 rounded-lg border border-hairline/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Scenes</h2>
          {currentManifest.scripts.length === 0 ? (
            <p className="text-sm text-silver">No scripts yet.</p>
          ) : (
            <div className="space-y-3">
              {currentManifest.scripts.map((script) => (
                <ScriptSegmentReviewList key={script.id} script={script} onChange={(segId, patch) => updateSegment(script.id, segId, patch)} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-hairline/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Storyboard Frames</h2>
          {currentManifest.storyboardFrames.length === 0 ? (
            <p className="text-sm text-silver">No storyboard frames yet.</p>
          ) : (
            <div className="space-y-3">
              {[...currentManifest.storyboardFrames]
                .sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber)
                .map((frame) => (
                  <div key={frame.id} className="rounded-md border border-hairline/10 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-cream">
                        Scene {frame.sceneNumber}, Shot {frame.shotNumber} -- {frame.shotType.replace(/-/g, " ")}
                      </span>
                      <select
                        value={frame.productionStatus}
                        onChange={(e) => updateFrame(frame.id, { productionStatus: e.target.value as StoryboardFrame["productionStatus"] })}
                        className="rounded border border-hairline/10 bg-navy px-2 py-1 text-xs text-cream"
                      >
                        <option value="draft">Draft</option>
                        <option value="in-progress">In Progress</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                    <textarea
                      value={frame.reviewNotes ?? ""}
                      onChange={(e) => updateFrame(frame.id, { reviewNotes: e.target.value })}
                      placeholder="Reviewer notes..."
                      rows={2}
                      className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
                    />
                  </div>
                ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ScriptSegmentReviewList({
  script,
  onChange,
}: {
  script: Script;
  onChange: (segmentId: string, patch: Partial<ScriptSegment>) => void;
}): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-cream">{script.title}</p>
      <div className="space-y-2">
        {script.segments.map((seg) => (
          <div key={seg.id} className={`rounded-md border p-3 ${seg.unverifiedClaim ? "border-bronze/50 bg-bronze/5" : "border-hairline/10"}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <span className="text-sm text-cream">
                  Scene {seg.sceneNumber}
                  {seg.sceneTitle ? ` -- ${seg.sceneTitle}` : ""}
                </span>
                {seg.unverifiedClaim && <span className="ml-2 text-xs text-bronze">unverified claim</span>}
              </div>
              <select
                value={seg.approvalStatus}
                onChange={(e) => onChange(seg.id, { approvalStatus: e.target.value as ScriptSegment["approvalStatus"] })}
                className="rounded border border-hairline/10 bg-navy px-2 py-1 text-xs text-cream"
              >
                <option value="draft">Draft</option>
                <option value="in-review">In Review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            {seg.narration && <p className="mb-2 text-xs italic text-silver">{seg.narration}</p>}
            <textarea
              value={seg.reviewNotes ?? ""}
              onChange={(e) => onChange(seg.id, { reviewNotes: e.target.value })}
              placeholder="Reviewer notes..."
              rows={2}
              className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
