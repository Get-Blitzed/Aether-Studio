import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../components/NavSidebar";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";

export function Home(): JSX.Element {
  const navigate = useNavigate();
  const recentProjects = useAppStore((s) => s.recentProjects);
  const refreshRecentProjects = useAppStore((s) => s.refreshRecentProjects);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const lastError = useAppStore((s) => s.lastError);
  const setLastError = useAppStore((s) => s.setLastError);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    refreshRecentProjects();
  }, [refreshRecentProjects]);

  async function openProjectDir(projectDir: string) {
    const result = await window.aether.projects.open(projectDir);
    if (result.ok) {
      setCurrentProject(projectDir, result.manifest);
      navigate("/production");
    } else {
      setLastError(result.error ?? { title: "Unable to open production", detail: "Unknown error" });
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const result = await window.aether.projects.create({ title: newTitle.trim() });
    setCreating(false);
    if (result.ok) {
      setCurrentProject(result.projectDir, result.manifest);
      setNewTitle("");
      navigate("/production");
    } else {
      setLastError(result.error ?? { title: "Unable to create production", detail: "Unknown error" });
    }
  }

  async function handleOpen() {
    const result = await window.aether.projects.chooseAndOpen();
    if (result.canceled) return;
    if (result.ok) {
      setCurrentProject(result.projectDir, result.manifest);
      navigate("/production");
    } else {
      setLastError(result.error ?? { title: "Unable to open production", detail: "Unknown error" });
    }
  }

  async function handleSample() {
    const result = await window.aether.projects.openSample();
    if (result.ok) {
      setCurrentProject(result.projectDir, result.manifest);
      navigate("/production");
    } else {
      setLastError(result.error ?? { title: "Unable to open sample", detail: "Unknown error" });
    }
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-cream">Home</h1>
          <p className="text-sm text-silver">Plan it. Create it. Animate it. Deliver it.</p>
        </header>

        {lastError && (
          <div className="mb-6">
            <ErrorBanner error={lastError} onDismiss={() => setLastError(null)} />
          </div>
        )}

        <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-charcoal p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-electric-blue to-aurora-pink text-lg">
                ✦
              </span>
              <h2 className="font-medium text-cream">New Production</h2>
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Production title"
              className="mb-3 w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
            />
            <button
              type="button"
              disabled={creating || !newTitle.trim()}
              onClick={handleCreate}
              className="w-full rounded-full bg-gradient-to-r from-electric-blue to-aurora-pink px-3 py-2 text-sm font-medium text-navy disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-charcoal p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-aurora-cyan to-electric-blue text-lg">
                ⌾
              </span>
              <h2 className="font-medium text-cream">Open Production</h2>
            </div>
            <p className="mb-3 text-sm text-silver">Select an existing project folder containing project.aether.</p>
            <button
              type="button"
              onClick={handleOpen}
              className="w-full rounded-full border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
            >
              Choose Folder...
            </button>
          </div>

          <div className="rounded-lg border border-bronze/40 bg-bronze/10 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-bronze text-lg text-navy">
                ★
              </span>
              <h2 className="font-medium text-cream">A.I. Blitz Sample Template</h2>
            </div>
            <p className="mb-3 text-sm text-silver">Mission 001, with Blitz's character profile pre-filled.</p>
            <button
              type="button"
              onClick={handleSample}
              className="w-full rounded-full bg-bronze px-3 py-2 text-sm font-medium text-navy"
            >
              Open Sample
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-medium text-cream">Recent Productions</h2>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-silver">No productions yet. Create one or open the sample above.</p>
          ) : (
            <ul className="divide-y divide-white/10 rounded-lg border border-white/10 bg-charcoal">
              {recentProjects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openProjectDir(p.project_dir)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                  >
                    <div>
                      <p className="text-cream">{p.title}</p>
                      <p className="text-xs text-silver">
                        {p.production_type ?? "custom"} - {p.stage ?? "idea"}
                      </p>
                    </div>
                    {p.isMissing && (
                      <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-300">Missing files</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
