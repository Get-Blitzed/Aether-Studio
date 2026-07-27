import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import type { StoryboardFrame, ShotType } from "@aether/shared-types";

const SHOT_TYPES: ShotType[] = [
  "extreme-wide",
  "wide",
  "full-body",
  "medium",
  "medium-close-up",
  "close-up",
  "extreme-close-up",
  "over-the-shoulder",
  "point-of-view",
  "screen-insert",
  "interface-close-up",
  "product-demonstration",
  "split-screen",
  "montage",
  "title-card",
  "end-card",
];

export function StoryboardStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const isSaving = useAppStore((s) => s.isSaving);
  const [view, setView] = useState<"grid" | "list">("grid");

  if (!currentManifest) return <NoProjectOpen what="storyboards" />;

  const frames = [...currentManifest.storyboardFrames].sort(
    (a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber - b.shotNumber,
  );
  const allSegments = currentManifest.scripts.flatMap((s) => s.segments);

  async function addFrame() {
    const timestamp = nowIso();
    const nextScene = frames.length > 0 ? frames[frames.length - 1]!.sceneNumber : 1;
    const frame: StoryboardFrame = {
      id: generateId("frame"),
      sceneNumber: nextScene,
      shotNumber: frames.filter((f) => f.sceneNumber === nextScene).length + 1,
      shotType: "medium",
      props: [],
      interfaceElements: [],
      productionStatus: "draft",
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, storyboardFrames: [...m.storyboardFrames, frame] }));
  }

  async function updateFrame(id: string, patch: Partial<StoryboardFrame>) {
    await updateAndSave((m) => ({
      ...m,
      storyboardFrames: m.storyboardFrames.map((f) => (f.id === id ? { ...f, ...patch, modifiedAt: nowIso() } : f)),
    }));
  }

  async function removeFrame(id: string) {
    await updateAndSave((m) => ({ ...m, storyboardFrames: m.storyboardFrames.filter((f) => f.id !== id) }));
  }

  async function duplicateFrame(frame: StoryboardFrame) {
    const timestamp = nowIso();
    const copy: StoryboardFrame = { ...frame, id: generateId("frame"), createdAt: timestamp, modifiedAt: timestamp };
    await updateAndSave((m) => ({ ...m, storyboardFrames: [...m.storyboardFrames, copy] }));
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Storyboard Studio</h1>
            <p className="text-sm text-silver">Convert scripts into a visual production plan.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex rounded-md border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`px-3 py-2 ${view === "grid" ? "bg-electric-blue/15 text-electric-blue" : "text-silver"}`}
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-3 py-2 ${view === "list" ? "bg-electric-blue/15 text-electric-blue" : "text-silver"}`}
              >
                Scene List
              </button>
            </div>
            <button
              type="button"
              onClick={addFrame}
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
            >
              + Add Shot
            </button>
          </div>
        </header>

        {frames.length === 0 ? (
          <p className="text-sm text-silver">No storyboard frames yet. Add a shot to begin planning.</p>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {frames.map((frame) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                segments={allSegments}
                onChange={(patch) => updateFrame(frame.id, patch)}
                onRemove={() => removeFrame(frame.id)}
                onDuplicate={() => duplicateFrame(frame)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-charcoal">
            {frames.map((frame) => (
              <div key={frame.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-cream">
                  Scene {frame.sceneNumber}, Shot {frame.shotNumber} -- {frame.shotType.replace(/-/g, " ")}
                </span>
                <span className="text-xs text-silver">{frame.productionStatus}</span>
              </div>
            ))}
          </div>
        )}
        {isSaving && <p className="mt-4 text-xs text-silver">Saving...</p>}
      </main>
    </div>
  );
}

function FrameCard({
  frame,
  segments,
  onChange,
  onRemove,
  onDuplicate,
}: {
  frame: StoryboardFrame;
  segments: Array<{ id: string; sceneNumber: number; sceneTitle?: string }>;
  onChange: (patch: Partial<StoryboardFrame>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-white/10 bg-charcoal p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-silver">
            Scene
            <input
              type="number"
              value={frame.sceneNumber}
              onChange={(e) => onChange({ sceneNumber: Number(e.target.value) })}
              className="ml-1 w-12 rounded border border-white/10 bg-navy px-1 py-0.5 text-cream"
            />
          </label>
          <label className="text-xs text-silver">
            Shot
            <input
              type="number"
              value={frame.shotNumber}
              onChange={(e) => onChange({ shotNumber: Number(e.target.value) })}
              className="ml-1 w-12 rounded border border-white/10 bg-navy px-1 py-0.5 text-cream"
            />
          </label>
        </div>
        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-silver">{frame.productionStatus}</span>
      </div>

      <div className="mb-2 flex h-24 items-center justify-center rounded-md border border-dashed border-white/15 text-xs text-silver/50">
        {frame.thumbnailPath ? "Thumbnail" : "No thumbnail (import via Asset Library, Phase 3)"}
      </div>

      <select
        value={frame.shotType}
        onChange={(e) => onChange({ shotType: e.target.value as ShotType })}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream"
      >
        {SHOT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replace(/-/g, " ")}
          </option>
        ))}
      </select>

      <textarea
        value={frame.sceneDescription ?? ""}
        onChange={(e) => onChange({ sceneDescription: e.target.value })}
        placeholder="Scene description"
        rows={2}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream focus-visible:outline-none"
      />

      <select
        value={frame.linkedScriptSegmentId ?? ""}
        onChange={(e) => onChange({ linkedScriptSegmentId: e.target.value || undefined })}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream"
      >
        <option value="">Not linked to a scene</option>
        {segments.map((seg) => (
          <option key={seg.id} value={seg.id}>
            Scene {seg.sceneNumber}
            {seg.sceneTitle ? ` -- ${seg.sceneTitle}` : ""}
          </option>
        ))}
      </select>

      <textarea
        value={frame.generationPrompt ?? ""}
        onChange={(e) => onChange({ generationPrompt: e.target.value })}
        placeholder="Generation prompt"
        rows={2}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream focus-visible:outline-none"
      />
      <textarea
        value={frame.negativePrompt ?? ""}
        onChange={(e) => onChange({ negativePrompt: e.target.value })}
        placeholder="Negative prompt"
        rows={1}
        className="mb-2 w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream focus-visible:outline-none"
      />

      <div className="flex items-center justify-between">
        <select
          value={frame.productionStatus}
          onChange={(e) => onChange({ productionStatus: e.target.value as StoryboardFrame["productionStatus"] })}
          className="rounded border border-white/10 bg-navy px-2 py-1 text-xs text-cream"
        >
          <option value="draft">Draft</option>
          <option value="in-progress">In Progress</option>
          <option value="approved">Approved</option>
        </select>
        <div className="flex gap-1">
          <button type="button" onClick={onDuplicate} className="rounded px-2 py-1 text-xs text-silver hover:bg-white/10">
            Duplicate
          </button>
          <button type="button" onClick={onRemove} className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
