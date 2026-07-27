import { useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import { toFileUrl } from "../lib/fileUrl";
import type { VoiceProfile, VoiceTake } from "@aether/shared-types";

export function VoiceStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const updateAndSave = useAppStore((s) => s.updateAndSave);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    currentManifest?.voiceProfiles[0]?.id ?? null,
  );
  const [selectedTakeIds, setSelectedTakeIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="voice takes" />;

  const profiles = currentManifest.voiceProfiles;
  const selected = profiles.find((p) => p.id === selectedProfileId) ?? null;
  const takes = currentManifest.voiceTakes
    .filter((t) => t.voiceProfileId === selectedProfileId)
    .sort((a, b) => a.takeNumber - b.takeNumber);

  async function addProfile() {
    const timestamp = nowIso();
    const profile: VoiceProfile = {
      id: generateId("voice"),
      name: "New Voice",
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, voiceProfiles: [...m.voiceProfiles, profile] }));
    setSelectedProfileId(profile.id);
  }

  async function updateProfile(patch: Partial<VoiceProfile>) {
    if (!selected) return;
    await updateAndSave((m) => ({
      ...m,
      voiceProfiles: m.voiceProfiles.map((p) => (p.id === selected.id ? { ...p, ...patch, modifiedAt: nowIso() } : p)),
    }));
  }

  async function removeProfile(id: string) {
    await updateAndSave((m) => ({ ...m, voiceProfiles: m.voiceProfiles.filter((p) => p.id !== id) }));
    setSelectedProfileId(null);
  }

  async function handleImport() {
    if (!currentProjectDir) return;
    const filePaths = await window.aether.voice.chooseAudioFiles();
    if (!filePaths) return;
    setBusy(true);
    const result = await window.aether.voice.importTakes({
      projectDir: currentProjectDir,
      filePaths,
      voiceProfileId: selectedProfileId ?? undefined,
    });
    setBusy(false);
    if (result.ok) setCurrentProject(currentProjectDir, result.manifest);
    else setError(result.error ?? { title: "Import failed", detail: "Unknown error" });
  }

  async function handleProcess(takeId: string, action: "normalize" | "denoise" | "remove-silence") {
    if (!currentProjectDir) return;
    setBusy(true);
    const result = await window.aether.voice.processTake({ projectDir: currentProjectDir, takeId, action });
    setBusy(false);
    if (result.ok) setCurrentProject(currentProjectDir, result.manifest);
    else setError(result.error ?? { title: "Processing failed", detail: "Unknown error" });
  }

  async function handleTrim(takeId: string, start: number, end: number) {
    if (!currentProjectDir) return;
    setBusy(true);
    const result = await window.aether.voice.processTake({
      projectDir: currentProjectDir,
      takeId,
      action: "trim",
      trimStartSeconds: start,
      trimEndSeconds: end,
    });
    setBusy(false);
    if (result.ok) setCurrentProject(currentProjectDir, result.manifest);
    else setError(result.error ?? { title: "Trim failed", detail: "Unknown error" });
  }

  async function handleExport(takeId: string, format: "wav" | "mp3") {
    if (!currentProjectDir) return;
    const result = await window.aether.voice.exportTake({ projectDir: currentProjectDir, takeId, format });
    if (!result.ok) {
      if (!result.canceled) setError(result.error ?? { title: "Export failed", detail: "Unknown error" });
    }
  }

  async function handleRemoveTake(takeId: string) {
    if (!currentProjectDir) return;
    const result = await window.aether.voice.removeTake(currentProjectDir, takeId);
    if (result.ok) setCurrentProject(currentProjectDir, result.manifest);
    else setError(result.error ?? { title: "Remove failed", detail: "Unknown error" });
  }

  async function handleMerge() {
    if (selectedTakeIds.size < 2 || !currentProjectDir) return;
    setBusy(true);
    const result = await window.aether.voice.mergeTakes({
      projectDir: currentProjectDir,
      takeIds: [...selectedTakeIds],
      voiceProfileId: selectedProfileId ?? undefined,
    });
    setBusy(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      setSelectedTakeIds(new Set());
    } else {
      setError(result.error ?? { title: "Merge failed", detail: "Unknown error" });
    }
  }

  function toggleTakeSelection(takeId: string) {
    setSelectedTakeIds((prev) => {
      const next = new Set(prev);
      if (next.has(takeId)) next.delete(takeId);
      else next.add(takeId);
      return next;
    });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Voice Studio</h1>
            <p className="text-sm text-silver">
              Manage narration takes for {currentManifest.title}. No connected voice-generation provider is
              required -- import recordings and process them locally.
            </p>
          </div>
          <button
            type="button"
            onClick={addProfile}
            className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
          >
            + New Voice Profile
          </button>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="flex gap-6">
          <aside className="w-56 flex-shrink-0 space-y-1">
            {profiles.length === 0 && <p className="text-sm text-silver">No voice profiles yet.</p>}
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfileId(p.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  p.id === selected?.id ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-white/5"
                }`}
              >
                {p.name}
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-5">
              <div className="rounded-lg border border-white/10 bg-charcoal p-4">
                <div className="mb-3 flex items-center justify-between">
                  <input
                    value={selected.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeProfile(selected.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    Delete Profile
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-silver">Character</label>
                    <select
                      value={selected.characterId ?? ""}
                      onChange={(e) => updateProfile({ characterId: e.target.value || undefined })}
                      className="w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    >
                      <option value="">Unassigned</option>
                      {currentManifest.characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-silver">Provider (informational only)</label>
                    <input
                      value={selected.provider ?? ""}
                      onChange={(e) => updateProfile({ provider: e.target.value })}
                      placeholder="e.g. ElevenLabs, Cartesia"
                      className="w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-silver">Emotion / Direction</label>
                    <input
                      value={selected.emotion ?? ""}
                      onChange={(e) => updateProfile({ emotion: e.target.value })}
                      className="w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-silver">Emphasis Notes</label>
                    <input
                      value={selected.emphasis ?? ""}
                      onChange={(e) => updateProfile({ emphasis: e.target.value })}
                      className="w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs text-silver">Pronunciation Notes</label>
                    <input
                      value={selected.pronunciationNotes ?? ""}
                      onChange={(e) => updateProfile({ pronunciationNotes: e.target.value })}
                      className="w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="font-medium text-cream">Takes ({takes.length})</h2>
                <div className="flex gap-2">
                  {selectedTakeIds.size >= 2 && (
                    <button
                      type="button"
                      onClick={handleMerge}
                      disabled={busy}
                      className="rounded-md border border-electric-blue/50 px-3 py-1.5 text-xs text-electric-blue hover:bg-electric-blue/10 disabled:opacity-50"
                    >
                      Merge {selectedTakeIds.size} Selected
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={busy}
                    className="rounded-md bg-electric-blue px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-50"
                  >
                    {busy ? "Working..." : "Import Takes..."}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {takes.length === 0 && <p className="text-sm text-silver">No takes yet for this voice profile.</p>}
                {takes.map((take) => (
                  <TakeCard
                    key={take.id}
                    take={take}
                    projectDir={currentProjectDir}
                    selected={selectedTakeIds.has(take.id)}
                    onToggleSelect={() => toggleTakeSelection(take.id)}
                    onProcess={(action) => handleProcess(take.id, action)}
                    onTrim={(start, end) => handleTrim(take.id, start, end)}
                    onExport={(format) => handleExport(take.id, format)}
                    onRemove={() => handleRemoveTake(take.id)}
                    onStatusChange={(status) =>
                      updateAndSave((m) => ({
                        ...m,
                        voiceTakes: m.voiceTakes.map((t) => (t.id === take.id ? { ...t, status } : t)),
                      }))
                    }
                    disabled={busy}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a voice profile.</p>
          )}
        </div>
      </main>
    </div>
  );
}

function TakeCard({
  take,
  projectDir,
  selected,
  onToggleSelect,
  onProcess,
  onTrim,
  onExport,
  onRemove,
  onStatusChange,
  disabled,
}: {
  take: VoiceTake;
  projectDir: string;
  selected: boolean;
  onToggleSelect: () => void;
  onProcess: (action: "normalize" | "denoise" | "remove-silence") => void;
  onTrim: (start: number, end: number) => void;
  onExport: (format: "wav" | "mp3") => void;
  onRemove: () => void;
  onStatusChange: (status: VoiceTake["status"]) => void;
  disabled: boolean;
}): JSX.Element {
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState(take.durationSeconds ? take.durationSeconds.toFixed(1) : "");

  return (
    <div className="rounded-lg border border-white/10 bg-charcoal p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select for merge" />
          <span className="rounded bg-white/10 px-2 py-1 text-xs text-silver">Take {take.takeNumber}</span>
          <span className="text-sm text-cream">{take.originalFileName}</span>
        </div>
        <select
          value={take.status}
          onChange={(e) => onStatusChange(e.target.value as VoiceTake["status"])}
          className="rounded border border-white/10 bg-navy px-2 py-1 text-xs text-cream"
        >
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {take.waveformImagePath ? (
        <img
          src={toFileUrl(projectDir, take.waveformImagePath)}
          alt="Waveform"
          className="mb-2 h-16 w-full rounded bg-navy object-contain"
        />
      ) : (
        <div className="mb-2 flex h-16 w-full items-center justify-center rounded bg-navy text-xs text-silver/50">
          No waveform available
        </div>
      )}

      <audio controls src={toFileUrl(projectDir, take.filePath)} className="mb-2 w-full" style={{ height: 32 }} />

      <div className="mb-2 flex flex-wrap gap-3 text-xs text-silver">
        {take.durationSeconds !== undefined && <span>{take.durationSeconds.toFixed(1)}s</span>}
        {take.integratedLufs !== undefined && <span>{take.integratedLufs.toFixed(1)} LUFS</span>}
        {take.truePeakDbfs !== undefined && <span>Peak {take.truePeakDbfs.toFixed(1)} dBFS</span>}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onProcess("normalize")}
          className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Normalize
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onProcess("denoise")}
          className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Denoise
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onProcess("remove-silence")}
          className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Remove Silence
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExport("wav")}
          className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Export WAV
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onExport("mp3")}
          className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Export MP3
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          Remove
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-silver">
        Trim (sec)
        <input
          type="number"
          value={trimStart}
          onChange={(e) => setTrimStart(e.target.value)}
          className="w-16 rounded border border-white/10 bg-navy px-2 py-1 text-cream"
        />
        to
        <input
          type="number"
          value={trimEnd}
          onChange={(e) => setTrimEnd(e.target.value)}
          className="w-16 rounded border border-white/10 bg-navy px-2 py-1 text-cream"
        />
        <button
          type="button"
          disabled={disabled || trimStart === "" || trimEnd === ""}
          onClick={() => onTrim(Number(trimStart), Number(trimEnd))}
          className="rounded border border-white/20 px-2 py-1 text-cream hover:bg-white/5 disabled:opacity-50"
        >
          Apply Trim
        </button>
      </div>
      {take.notes && <p className="mt-2 text-xs italic text-silver">{take.notes}</p>}
    </div>
  );
}
