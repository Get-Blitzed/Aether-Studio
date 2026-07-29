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
  const [outlineSceneCount, setOutlineSceneCount] = useState(5);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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

  async function handleGenerateOutline() {
    if (!selected) return;
    setGeneratingOutline(true);
    setAiNotice(null);
    setAiError(null);
    const providers = await window.aether.providers.list();
    const candidates = providers.filter((p) => p.capability === "text" && p.enabled);
    const provider = candidates.find((p) => p.isDefaultForCapability) ?? candidates[0];
    if (!provider) {
      setGeneratingOutline(false);
      setAiError("No text provider configured. Add one in the Provider & Plugin Manager (a Mock provider works offline).");
      return;
    }
    const result = await window.aether.providers.runJob({
      jobType: "outline",
      providerId: provider.id,
      input: { title: selected.title, scene_count: outlineSceneCount },
    });
    setGeneratingOutline(false);
    if (!result.ok || !result.text) {
      setAiError(!result.ok ? result.error?.detail ?? "Generation failed." : "Provider returned no text.");
      return;
    }
    const newSegments: ScriptSegment[] = result.text
      .split("\n")
      .map((line) => line.split("|"))
      .filter((parts): parts is [string, string] => parts.length === 2)
      .map(([role, narration], i) => ({
        id: generateId("seg"),
        sceneNumber: selected.segments.length + i + 1,
        sceneTitle: role.trim(),
        narration: narration.trim(),
        soundEffects: [],
        sourceCitationIds: [],
        unverifiedClaim: false,
        approvalStatus: "draft" as const,
      }));
    if (newSegments.length === 0) {
      setAiError("Could not parse the provider's response into scenes.");
      return;
    }
    await updateScript({ segments: [...selected.segments, ...newSegments] });
    setAiNotice(`Added ${newSegments.length} scene${newSegments.length === 1 ? "" : "s"} from ${provider.name} (${provider.kind}).`);
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
            className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5"
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
                  s.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-hairline/5"
                }`}
              >
                {s.title}
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-4">
              <div className="rounded-lg border border-hairline/10 bg-charcoal p-4">
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
                      className="rounded border border-hairline/10 bg-navy px-2 py-1 text-cream"
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
                      className="w-20 rounded border border-hairline/10 bg-navy px-2 py-1 text-cream"
                    />
                  </label>
                </div>

                <ScriptStats script={selected} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium text-cream">Scenes ({selected.segments.length})</h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-silver">
                    Scenes to generate
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={outlineSceneCount}
                      onChange={(e) => setOutlineSceneCount(Number(e.target.value) || 5)}
                      className="w-14 rounded border border-hairline/10 bg-navy px-2 py-1 text-cream"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateOutline}
                    disabled={generatingOutline}
                    className="rounded-md border border-electric-blue/50 px-3 py-1.5 text-xs text-electric-blue hover:bg-electric-blue/10 disabled:opacity-50"
                  >
                    {generatingOutline ? "Generating..." : "Generate Outline (AI)"}
                  </button>
                  <button
                    type="button"
                    onClick={addSegment}
                    className="rounded-md border border-hairline/20 px-3 py-1.5 text-xs text-cream hover:bg-hairline/5"
                  >
                    + Add Scene
                  </button>
                </div>
              </div>
              {aiNotice && <p className="text-xs text-emerald-300">{aiNotice}</p>}
              {aiError && <p className="text-xs text-red-300">{aiError}</p>}

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
    <div className="mt-3 flex flex-wrap gap-4 border-t border-hairline/10 pt-3 text-xs text-silver">
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
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  async function handleImproveHook() {
    if (!segment.narration?.trim()) {
      setImproveError("Add narration text first.");
      return;
    }
    setImproving(true);
    setImproveError(null);
    const providers = await window.aether.providers.list();
    const candidates = providers.filter((p) => p.capability === "text" && p.enabled);
    const provider = candidates.find((p) => p.isDefaultForCapability) ?? candidates[0];
    if (!provider) {
      setImproving(false);
      setImproveError("No text provider configured.");
      return;
    }
    const result = await window.aether.providers.runJob({
      jobType: "improve-hook",
      providerId: provider.id,
      input: { current: segment.narration },
    });
    setImproving(false);
    if (!result.ok || !result.text) {
      setImproveError(!result.ok ? result.error?.detail ?? "Generation failed." : "Provider returned no text.");
      return;
    }
    onChange({ narration: result.text });
  }

  return (
    <div className={`rounded-lg border p-4 ${segment.unverifiedClaim ? "border-bronze/50 bg-bronze/5" : "border-hairline/10 bg-charcoal"}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="rounded bg-hairline/10 px-2 py-1 text-xs text-silver">Scene {segment.sceneNumber}</span>
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
            className="rounded border border-hairline/10 bg-navy px-2 py-1 text-xs text-cream"
          >
            <option value="draft">Draft</option>
            <option value="in-review">In Review</option>
            <option value="approved">Approved</option>
          </select>
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="rounded px-2 py-1 text-xs text-silver hover:bg-hairline/10 disabled:opacity-30">↑</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="rounded px-2 py-1 text-xs text-silver hover:bg-hairline/10 disabled:opacity-30">↓</button>
          <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">Remove</button>
        </div>
      </div>

      <textarea
        value={segment.narration ?? ""}
        onChange={(e) => onChange({ narration: e.target.value })}
        placeholder="Narration"
        rows={2}
        className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
      />
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={handleImproveHook}
          disabled={improving}
          className="rounded border border-electric-blue/50 px-2 py-1 text-xs text-electric-blue hover:bg-electric-blue/10 disabled:opacity-50"
        >
          {improving ? "Improving..." : "Improve Hook (AI)"}
        </button>
        {improveError && <span className="text-xs text-red-300">{improveError}</span>}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input
          value={segment.onScreenAction ?? ""}
          onChange={(e) => onChange({ onScreenAction: e.target.value })}
          placeholder="On-screen action"
          className="rounded-md border border-hairline/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
        />
        <input
          value={segment.overlayText ?? ""}
          onChange={(e) => onChange({ overlayText: e.target.value })}
          placeholder="Overlay text"
          className="rounded-md border border-hairline/10 bg-navy px-3 py-2 text-xs text-cream focus-visible:outline-none"
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
