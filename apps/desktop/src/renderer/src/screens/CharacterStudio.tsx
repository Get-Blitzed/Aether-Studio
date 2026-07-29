import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import { toFileUrl } from "../lib/fileUrl";
import type { Character, CharacterConsistencyLocks, CharacterReferenceCategory } from "@aether/shared-types";

const LOCK_LABELS: Record<keyof CharacterConsistencyLocks, string> = {
  referenceLock: "Reference",
  costumeLock: "Costume",
  colorLock: "Color",
  silhouetteLock: "Silhouette",
  maskLock: "Mask",
  hairstyleLock: "Hairstyle",
  accessoryLock: "Accessory",
};

const REFERENCE_CATEGORIES: CharacterReferenceCategory[] = [
  "front-view",
  "left-side-view",
  "right-side-view",
  "rear-view",
  "full-body-view",
  "close-up",
  "action-pose",
  "alternate-wardrobe",
  "emotion-or-state",
];

export function CharacterStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const isSaving = useAppStore((s) => s.isSaving);
  const [selectedId, setSelectedId] = useState<string | null>(currentManifest?.characters[0]?.id ?? null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="characters" />;

  const characters = currentManifest.characters;
  const selected = characters.find((c) => c.id === selectedId) ?? characters[0] ?? null;

  async function addCharacter() {
    const timestamp = nowIso();
    const character: Character = {
      id: generateId("char"),
      name: "New Character",
      wardrobe: [],
      colors: [],
      materials: [],
      props: [],
      signatureGestures: [],
      signaturePoses: [],
      allowedEmotions: [],
      prohibitedBehaviors: [],
      cameraRules: [],
      lightingRules: [],
      animationRestrictions: [],
      requiresLipSync: true,
      references: [],
      locks: {
        referenceLock: false,
        costumeLock: false,
        colorLock: false,
        silhouetteLock: false,
        maskLock: false,
        hairstyleLock: false,
        accessoryLock: false,
      },
      versionHistory: [],
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, characters: [...m.characters, character] }));
    setSelectedId(character.id);
  }

  async function updateCharacter(patch: Partial<Character>) {
    if (!selected) return;
    await updateAndSave((m) => ({
      ...m,
      characters: m.characters.map((c) => (c.id === selected.id ? { ...c, ...patch, modifiedAt: nowIso() } : c)),
    }));
  }

  async function toggleLock(key: keyof CharacterConsistencyLocks) {
    if (!selected) return;
    await updateCharacter({ locks: { ...selected.locks, [key]: !selected.locks[key] } });
  }

  async function removeCharacter(id: string) {
    await updateAndSave((m) => ({ ...m, characters: m.characters.filter((c) => c.id !== id) }));
    setSelectedId(null);
  }

  async function handleImportReference() {
    if (!selected || !currentProjectDir) return;
    const result = await window.aether.projects.importCharacterReference(currentProjectDir, selected.id);
    if (result.canceled) return;
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
    } else {
      setError(result.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  async function approveReference(referenceId: string, approved: boolean) {
    if (!selected) return;
    await updateCharacter({
      references: selected.references.map((r) => (r.id === referenceId ? { ...r, approved } : r)),
    });
  }

  async function setReferenceCategory(referenceId: string, category: CharacterReferenceCategory) {
    if (!selected) return;
    await updateCharacter({
      references: selected.references.map((r) => (r.id === referenceId ? { ...r, category } : r)),
    });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Character Studio</h1>
            <p className="text-sm text-silver">Maintain visual and behavioral consistency for recurring characters.</p>
          </div>
          <button
            type="button"
            onClick={addCharacter}
            className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5"
          >
            + New Character
          </button>
        </header>

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="flex gap-6">
          <aside className="w-56 flex-shrink-0 space-y-1">
            {characters.length === 0 && <p className="text-sm text-silver">No characters yet.</p>}
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  c.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-hairline/5"
                }`}
              >
                {c.name}
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-hairline/10 bg-charcoal p-4">
                <input
                  value={selected.name}
                  onChange={(e) => updateCharacter({ name: e.target.value })}
                  className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeCharacter(selected.id)}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg border border-hairline/10 bg-charcoal p-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-cream">Role</label>
                  <input
                    value={selected.role ?? ""}
                    onChange={(e) => updateCharacter({ role: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-cream">Character Type</label>
                  <input
                    value={selected.characterType ?? ""}
                    onChange={(e) => updateCharacter({ characterType: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-cream">Personality</label>
                  <input
                    value={selected.personality ?? ""}
                    onChange={(e) => updateCharacter({ personality: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-cream">Speaking Style</label>
                  <input
                    value={selected.speakingStyle ?? ""}
                    onChange={(e) => updateCharacter({ speakingStyle: e.target.value })}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-cream">Visual Description</label>
                  <textarea
                    value={selected.visualDescription ?? ""}
                    onChange={(e) => updateCharacter({ visualDescription: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-hairline/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-silver">
                  <input
                    type="checkbox"
                    checked={selected.requiresLipSync}
                    onChange={(e) => updateCharacter({ requiresLipSync: e.target.checked })}
                  />
                  Requires lip synchronization (uncheck for masked/faceless characters)
                </label>
              </div>

              <div className="rounded-lg border border-hairline/10 bg-charcoal p-5">
                <p className="mb-3 text-sm font-medium text-cream">Consistency Locks</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(LOCK_LABELS) as Array<keyof CharacterConsistencyLocks>).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleLock(key)}
                      className={`rounded-full border px-3 py-1.5 text-xs ${
                        selected.locks[key]
                          ? "border-electric-blue bg-electric-blue/15 text-electric-blue"
                          : "border-hairline/15 text-silver hover:border-hairline/30"
                      }`}
                    >
                      {selected.locks[key] ? "🔒" : "🔓"} {LOCK_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-hairline/10 bg-charcoal p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-cream">
                    Reference Gallery ({selected.references.length})
                  </p>
                  <button
                    type="button"
                    onClick={handleImportReference}
                    className="rounded-md border border-electric-blue/50 px-3 py-1.5 text-xs text-electric-blue hover:bg-electric-blue/10"
                  >
                    Import Reference Image
                  </button>
                </div>
                {selected.references.length === 0 ? (
                  <p className="text-sm text-silver">
                    No reference images yet. Import a front view, action pose, or other reference to lock this
                    character's look.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {selected.references.map((ref) => (
                      <div key={ref.id} className="rounded-md border border-hairline/10 p-2">
                        <img
                          src={toFileUrl(currentProjectDir, ref.filePath)}
                          alt={ref.category}
                          className="mb-2 h-32 w-full rounded object-cover"
                        />
                        <select
                          value={ref.category}
                          onChange={(e) =>
                            setReferenceCategory(ref.id, e.target.value as CharacterReferenceCategory)
                          }
                          className="mb-2 w-full rounded border border-hairline/10 bg-navy px-1 py-1 text-xs text-cream"
                        >
                          {REFERENCE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.replace(/-/g, " ")}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs text-silver">
                          <input
                            type="checkbox"
                            checked={ref.approved}
                            onChange={(e) => approveReference(ref.id, e.target.checked)}
                          />
                          Approved
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isSaving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a character.</p>
          )}
        </div>
      </main>
    </div>
  );
}
