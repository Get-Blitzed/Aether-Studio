import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import { assemblePromptText } from "../lib/promptText";
import type { Prompt, PromptCategory } from "@aether/shared-types";

const CATEGORIES: PromptCategory[] = [
  "language-generation",
  "image-generation",
  "image-to-video",
  "text-to-video",
  "character-animation",
  "scene-extension",
  "camera-motion",
  "background-replacement",
  "voice-generation",
  "music-generation",
  "sound-effect-generation",
  "thumbnail-generation",
  "captions",
  "translation",
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-hairline/10 text-silver",
  approved: "bg-emerald-500/15 text-emerald-300",
  deprecated: "bg-red-500/15 text-red-300",
};

export function PromptWorkshop(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const isSaving = useAppStore((s) => s.isSaving);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!currentManifest) return <NoProjectOpen what="prompts" />;

  const prompts = currentManifest.prompts;
  const selected = prompts.find((p) => p.id === selectedId) ?? null;

  async function addPrompt() {
    const timestamp = nowIso();
    const prompt: Prompt = {
      id: generateId("prompt"),
      label: "New Prompt",
      category: "image-generation",
      providerSpecificOptions: {},
      status: "draft",
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, prompts: [...m.prompts, prompt] }));
    setSelectedId(prompt.id);
  }

  async function updatePrompt(patch: Partial<Prompt>) {
    if (!selected) return;
    await updateAndSave((m) => ({
      ...m,
      prompts: m.prompts.map((p) => (p.id === selected.id ? { ...p, ...patch, modifiedAt: nowIso() } : p)),
    }));
  }

  async function removePrompt(id: string) {
    await updateAndSave((m) => ({ ...m, prompts: m.prompts.filter((p) => p.id !== id) }));
    setSelectedId(null);
  }

  async function copyPrompt(prompt: Prompt) {
    await navigator.clipboard.writeText(assemblePromptText(prompt));
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Prompt Workshop</h1>
            <p className="text-sm text-silver">
              Store and refine prompts for image, video, voice, and language tools. Works without any connected
              provider -- copy prompts out to whatever tool you use today.
            </p>
          </div>
          <button
            type="button"
            onClick={addPrompt}
            className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5"
          >
            + New Prompt
          </button>
        </header>

        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0 space-y-1">
            {prompts.length === 0 && <p className="text-sm text-silver">No prompts yet.</p>}
            {prompts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  p.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-hairline/5"
                }`}
              >
                <p>{p.label}</p>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${STATUS_STYLES[p.status]}`}>
                  {p.status}
                </span>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-hairline/10 bg-charcoal p-4">
                <input
                  value={selected.label}
                  onChange={(e) => updatePrompt({ label: e.target.value })}
                  className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyPrompt(selected)}
                    className="rounded-md bg-electric-blue px-3 py-1.5 text-xs font-medium text-navy"
                  >
                    {copiedId === selected.id ? "Copied!" : "Copy Prompt Text"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePrompt(selected.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg border border-hairline/10 bg-charcoal p-5">
                <div>
                  <label className="mb-1 block text-xs text-silver">Category</label>
                  <select
                    value={selected.category}
                    onChange={(e) => updatePrompt({ category: e.target.value as PromptCategory })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replace(/-/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Status</label>
                  <select
                    value={selected.status}
                    onChange={(e) => updatePrompt({ status: e.target.value as Prompt["status"] })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  >
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="deprecated">Deprecated</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Provider (informational only)</label>
                  <input
                    value={selected.provider ?? ""}
                    onChange={(e) => updatePrompt({ provider: e.target.value })}
                    placeholder="e.g. Runway, Kling, Stability AI"
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-silver">Model</label>
                  <input
                    value={selected.model ?? ""}
                    onChange={(e) => updatePrompt({ model: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline/10 bg-charcoal p-5">
                {(
                  [
                    ["subject", "Subject"],
                    ["action", "Action"],
                    ["environment", "Environment"],
                    ["composition", "Composition"],
                    ["camera", "Camera"],
                    ["lens", "Lens"],
                    ["lighting", "Lighting"],
                    ["mood", "Mood"],
                    ["visualStyle", "Visual Style"],
                    ["movement", "Movement"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-silver">{label}</label>
                    <input
                      value={(selected[key] as string) ?? ""}
                      onChange={(e) => updatePrompt({ [key]: e.target.value })}
                      className="w-full rounded-md border border-hairline/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-silver">Continuity Requirements</label>
                  <input
                    value={selected.continuityRequirements ?? ""}
                    onChange={(e) => updatePrompt({ continuityRequirements: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-2 py-1.5 text-sm text-cream"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-silver">Negative Prompt</label>
                  <textarea
                    value={selected.negativePrompt ?? ""}
                    onChange={(e) => updatePrompt({ negativePrompt: e.target.value })}
                    rows={2}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-2 py-1.5 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-hairline/10 bg-charcoal p-5">
                <p className="mb-2 text-xs text-silver">Assembled prompt preview</p>
                <p className="whitespace-pre-wrap rounded-md bg-navy p-3 text-sm text-cream">
                  {assemblePromptText(selected) || "Fill in fields above to build a prompt."}
                </p>
              </div>

              <div className="rounded-lg border border-hairline/10 bg-charcoal p-5">
                <label className="mb-1 block text-xs text-silver">Notes</label>
                <textarea
                  value={selected.notes ?? ""}
                  onChange={(e) => updatePrompt({ notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                />
              </div>
              {isSaving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a prompt.</p>
          )}
        </div>
      </main>
    </div>
  );
}
