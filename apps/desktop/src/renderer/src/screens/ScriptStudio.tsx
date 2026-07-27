import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import {
  NARRATION_SPEED_PRESETS,
  countWords,
  scriptWordCount,
  estimatedDurationSeconds,
  formatDuration,
} from "../lib/scriptMath";
import type { Script, ScriptSegment } from "@aether/shared-types";

export function ScriptStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const isSaving = useAppStore((s) => s.isSaving);
  const [selectedId, setSelectedId] = useState<string | null>(currentManifest?.scripts[0]?.id ?? null);

  if (!currentManifest) return <NoProjectOpen what="scripts" />;

  const scripts = currentManifest.scripts;
  const selected = scripts.find((s) => s.id === selectedId) ?? scripts[0] ?? null;

  async function addScript() {
    const timestamp = nowIso();
    const script: Script = {
      id: generateId("script"),
      title: "New Script",
      narrationSpeedWpm: 130,
      segments: [],
      revision: 1,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, scripts: [...m.scripts, script] }));
    setSelectedId(script.id);
  }

  async function updateScript(patch: Partial<Script>) {
    if (!selected) return;
    await updateAndSave((m) => ({
      ...m,
      scripts: m.scripts.map((s) => (s.id === selected.id ? { ...s, ...patch, modifiedAt: nowIso() } : s)),
    }));
  }

  async function removeScript(id: string) {
    await updateAndSave((m) => ({ ...m, scripts: m.scripts.filter((s) => s.id !== id) }));
    setSelectedId(null);
  }

  function updateSegment(segId: string, patch: Partial<ScriptSegment>) {
    if (!selected) return;
    void updateScript({
      segments: selected.segments.map((seg) => (seg.id === segId ? { ...seg, ...patch } : seg)),
    });
  }

  function addSegment() {
    if (!selected) return;
    const segment: ScriptSegment = {
      id: generateId("seg"),
      sceneNumber: selected.segments.length + 1,
      soundEffects: [],
      sourceCitationIds: [],
      unverifiedClaim: false,
      approvalStatus: "draft",
    };
    void updateScript({ segments: [...selected.segments, segment] });
  }

  function removeSegment(segId: string) {
    if (!selected) return;
    const segments = selected.segments
      .filter((s) => s.id !== segId)
      .map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    void updateScript({ segments });
  }

  function moveSegment(index: number, direction: -1 | 1) {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.segments.length) return;
    const segments = [...selected.segments];
    const [moved] = segments.splice(index, 1);
    segments.splice(target, 0, moved!);
    void updateScript({ segments: segments.map((s, i) => ({ ...s, sceneNumber: i + 1 })) });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Script Studio</h1>
            <p className="text-sm text-silver">Write, time, and review scripts for {currentManifest.title}.</p>
          </div>
          <button
            type="button"
            onClick={addScript}
            className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
          >
            + New Script
          </button>
        </header>

        <div className="flex gap-6">
          <aside className="w-56 flex-shrink-0 space-y-1">
            {scripts.length === 0 && <p className="text-sm text-silver">No scripts yet.</p>}
            {scripts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  s.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-white/5"
                }`}
              >
                {s.title}
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-4">
              <div className="rounded-lg border border-white/10 bg-charcoal p-4">
                <div className="mb-3 flex items-center justify-between">
                  <input
                    value={selected.title}
                    onChange={(e) => updateScript({ title: e.target.value })}
                    className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeScript(selected.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Delete Script
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-silver">
                  <label className="flex items-center gap-2">
                    Narration speed
                    <select
                      value={selected.narrationSpeedWpm}
                      onChange={(e) => updateScript({ narrationSpeedWpm: Number(e.target.value) })}
                      className="rounded border border-white/10 bg-navy px-2 py-1 text-cream"
                    >
                      {NARRATION_SPEED_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    Target duration (sec)
                    <input
                      type="number"
                      value={selected.targetDurationSeconds ?? ""}
                      onChange={(e) => updateScript({ targetDurationSeconds: Number(e.target.value) || undefined })}
                      className="w-20 rounded border border-white/10 bg-navy px-2 py-1 text-cream"
                    />
                  </label>
                </div>

                <ScriptStats script={selected} />
              </div>

              <div className="flex items-center justify-between">
                <h2 className="font-medium text-cream">Scenes ({selected.segments.length})</h2>
                <button
                  type="button"
                  onClick={addSegment}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-cream hover:bg-white/5"
                >
                  + Add Scene
                </button>
              </div>

              <div className="space-y-3">
                {selected.segments.map((seg, index) => (
                  <SegmentCard
                    key={seg.id}
                    segment={seg}
                    index={index}
                    total={selected.segments.length}
                    onChange={(patch) => updateSegment(seg.id, patch)}
                    onRemove={() => removeSegment(seg.id)}
                    onMove={(dir) => moveSegment(index, dir)}
                  />
                ))}
              </div>
              {isSaving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a script.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function ScriptStats({ script }: { script: Script }): JSX.Element {
  const words = scriptWordCount(script);
  const estimated = estimatedDurationSeconds(script);
  const target = script.targetDurationSeconds;
  const delta = target ? estimated - target : null;

  return (
    <div className="mt-3 flex flex-wrap gap-4 border-t border-white/10 pt-3 text-xs text-silver">
      <span>{script.segments.length} scenes</span>
      <span>{words} words</span>
      <span>Estimated: {formatDuration(estimated)}</span>
      {target !== undefined && target !== null && (
        <span className={delta && Math.abs(delta) > 30 ? "text-bronze" : ""}>
          Target: {formatDuration(target)}
          {delta !== null && (delta > 0 ? ` (+${formatDuration(delta)} over)` : delta < 0 ? ` (${formatDuration(-delta)} under)` : " (on target)")}
        </span>
      )}
      <span>{script.segments.filter((s) => s.approvalStatus !== "approved").length} unapproved</span>
      <span>{script.segments.filter((s) => s.unverifiedClaim).length} unverified claims</span>
    </div>
  );
}

function SegmentCard({
  segment,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  segment: ScriptSegment;
  index: number;
  total: number;
  onChange: (patch: Partial<ScriptSegment>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}): JSX.Element {
  const words = countWords(segment.narration);
  return (
    <div className={`rounded-lg border p-4 ${segment.unverifiedClaim ? "border-bronze/50 bg-bronze/5" : "border-white/10 bg-charcoal"}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-1 text-xs text-silver">Scene {segment.sceneNumber}</span>
          <input
            value={segment.sceneTitle ?? ""}
            onChange={(e) => onChange({ sceneTitle: e.target.value })}
            placeholder="Scene title"
            className="flex-1 bg-transparent font-medium text-cream focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <select
            value={segment.approvalStatus}
            onChange={(e) => onChange({ approvalStatus: e.target.value as ScriptSegment["approvalStatus"] })}
            className="rounded border border-white/10 bg-navy px-2 py-1 text-xs text-cream"
          >
            <option value="draft">Draft</option>
            <option value="in-review">In Review</option>
            <option value="approved">Approved</option>
          </select>
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded px-2 py-1 text-xs text-silver hover:bg-white/10 disabled:opacity-30">↑</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded px-2 py-1 text-xs text-silver hover:bg-white/10 disabled:opacity-30">↓</button>
          <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Remove</button>
        </div>
      </div>

      <textarea
        value={segment.narration ?? ""}
        onChange={(e) => onChange({ narration: e.target.value })}
        placeholder="Narration"
        rows={2}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
      />
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          value={segment.onScreenAction ?? ""}
          onChange={(e) => onChange({ onScreenAction: e.target.value })}
          placeholder="On-screen action"
          className="rounded-md border border-white/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
        />
        <input
          value={segment.overlayText ?? ""}
          onChange={(e) => onChange({ overlayText: e.target.value })}
          placeholder="Overlay text"
          className="rounded-md border border-white/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-silver">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={segment.unverifiedClaim} onChange={(e) => onChange({ unverifiedClaim: e.target.checked })} />
          Unverified claim -- confirm before publication
        </label>
        <span>{words} words</span>
      </div>
      {segment.notes && <p className="mt-2 text-xs italic text-silver">{segment.notes}</p>}
    </div>
  );
}
