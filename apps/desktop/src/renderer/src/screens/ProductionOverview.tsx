import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../components/NavSidebar";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";

export function ProductionOverview(): JSX.Element {
  const navigate = useNavigate();
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const currentManifest = useAppStore((s) => s.currentManifest);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const saveCurrentProject = useAppStore((s) => s.saveCurrentProject);
  const isSaving = useAppStore((s) => s.isSaving);
  const lastError = useAppStore((s) => s.lastError);
  const setLastError = useAppStore((s) => s.setLastError);
  const [description, setDescription] = useState(currentManifest?.description ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [backups, setBackups] = useState<string[]>([]);

  useEffect(() => {
    if (!currentProjectDir) {
      navigate("/home", { replace: true });
    }
  }, [currentProjectDir, navigate]);

  useEffect(() => {
    if (currentProjectDir) {
      window.aether.projects.listBackups(currentProjectDir).then((res) => {
        if (res.ok) setBackups(res.backups);
      });
    }
  }, [currentProjectDir]);

  if (!currentProjectDir || !currentManifest) {
    return <div className="p-8 text-cream">Loading...</div>;
  }

  async function handleSave() {
    if (currentManifest) {
      useAppStore.getState().setCurrentProject(currentProjectDir!, { ...currentManifest, description });
    }
    const ok = await saveCurrentProject();
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    }
  }

  async function handleImportCharacterSheet(characterId: string) {
    const result = await window.aether.projects.importCharacterReference(currentProjectDir!, characterId);
    if (result.canceled) return;
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
    } else {
      setLastError(result.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  async function handleOpenFolder() {
    await window.aether.shell.openPath(currentProjectDir!);
  }

  const { productionSettings, characters, brands, scripts, assets } = currentManifest;

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">{currentManifest.title}</h1>
            <p className="text-sm text-silver">
              {productionSettings.productionType} - stage: {productionSettings.stage}
              {productionSettings.series ? ` - ${productionSettings.series} ${productionSettings.episode ?? ""}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleOpenFolder}
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
            >
              Open Folder
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
            >
              {isSaving ? "Saving..." : savedFlash ? "Saved" : "Save"}
            </button>
          </div>
        </header>

        {lastError && (
          <div className="mb-6">
            <ErrorBanner error={lastError} onDismiss={() => setLastError(null)} />
          </div>
        )}

        {productionSettings.confidential && (
          <div className="mb-6 rounded-md border border-bronze/50 bg-bronze/10 px-4 py-2 text-xs text-bronze">
            Confidential production -- external provider calls should be reviewed before use.
          </div>
        )}

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Characters" value={characters.length} onClick={() => navigate("/characters")} />
          <StatCard label="Brands" value={brands.length} onClick={() => navigate("/brands")} />
          <StatCard label="Scripts" value={scripts.length} onClick={() => navigate("/scripts")} />
          <StatCard label="Assets" value={assets.length} onClick={() => navigate("/assets")} />
          <StatCard label="Backups" value={backups.length} />
        </section>

        <section className="mb-6 flex flex-wrap gap-2">
          {[
            { label: "Script Studio", path: "/scripts" },
            { label: "Storyboard Studio", path: "/storyboards" },
            { label: "Character Studio", path: "/characters" },
            { label: "Brand Studio", path: "/brands" },
            { label: "Knowledge Library", path: "/knowledge" },
            { label: "Prompt Workshop", path: "/prompts" },
            { label: "Series Planner", path: "/series" },
            { label: "Asset Library", path: "/assets" },
          ].map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-silver hover:border-electric-blue/50 hover:text-electric-blue"
            >
              {link.label} →
            </button>
          ))}
        </section>

        <section className="mb-6 rounded-lg border border-white/10 bg-charcoal p-5">
          <label htmlFor="desc" className="mb-2 block text-sm font-medium text-cream">
            Project Notes
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
          />
        </section>

        {characters.length > 0 && (
          <section className="mb-6 rounded-lg border border-white/10 bg-charcoal p-5">
            <h2 className="mb-3 font-medium text-cream">Characters</h2>
            {characters.map((c) => (
              <div key={c.id} className="mb-3 rounded-md border border-white/10 p-4 last:mb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-cream">
                      {c.name} <span className="text-xs font-normal text-silver">- {c.role}</span>
                    </p>
                    <p className="mt-1 text-xs text-silver">{c.personality}</p>
                  </div>
                  {c.references.length === 0 && (
                    <button
                      type="button"
                      onClick={() => handleImportCharacterSheet(c.id)}
                      className="whitespace-nowrap rounded-md border border-electric-blue/50 px-3 py-1.5 text-xs text-electric-blue hover:bg-electric-blue/10"
                    >
                      Locate character sheet
                    </button>
                  )}
                  {c.references.length > 0 && (
                    <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">
                      {c.references.length} reference{c.references.length === 1 ? "" : "s"} imported
                    </span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {scripts.length > 0 && (
          <section className="rounded-lg border border-white/10 bg-charcoal p-5">
            <h2 className="mb-3 font-medium text-cream">Scripts</h2>
            {scripts.map((s) => (
              <div key={s.id} className="mb-2 text-sm text-silver">
                <span className="text-cream">{s.title}</span> - {s.segments.length} scenes - target{" "}
                {s.targetDurationSeconds ? `${Math.round(s.targetDurationSeconds / 60)} min` : "unset"}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, onClick }: { label: string; value: number; onClick?: () => void }): JSX.Element {
  const content = (
    <>
      <p className="text-2xl font-semibold text-cream">{value}</p>
      <p className="text-xs text-silver">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-white/10 bg-charcoal p-4 text-center hover:border-electric-blue/40"
      >
        {content}
      </button>
    );
  }
  return <div className="rounded-lg border border-white/10 bg-charcoal p-4 text-center">{content}</div>;
}
