import { useEffect, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { ErrorBanner } from "../components/ErrorBanner";
import { generateId, nowIso } from "../lib/ids";
import { buildOrbitSampleCurriculum } from "../lib/orbitCurriculum";
import type { SeriesPlan, EpisodePlan } from "@aether/shared-types";

export function SeriesPlanner(): JSX.Element {
  const [series, setSeries] = useState<SeriesPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const list = await window.aether.series.list();
    setSeries(list);
    if (!selectedId && list.length > 0) setSelectedId(list[0]!.id);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = series.find((s) => s.id === selectedId) ?? null;

  async function persist(plan: SeriesPlan) {
    setSaving(true);
    const result = await window.aether.series.save({ ...plan, modifiedAt: nowIso() });
    setSaving(false);
    if (result.ok) {
      await refresh();
      setSelectedId(result.plan.id);
    } else {
      setError(result.error ?? { title: "Save failed", detail: "Unknown error" });
    }
  }

  async function handleNewSeries() {
    const timestamp = nowIso();
    const plan: SeriesPlan = {
      id: generateId("series"),
      title: "Untitled Series",
      episodes: [],
      recurringSegments: [],
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await persist(plan);
  }

  async function handleLoadSample() {
    await persist(buildOrbitSampleCurriculum());
  }

  async function handleDelete(id: string) {
    const result = await window.aether.series.remove(id);
    if (result.ok) {
      setSelectedId(null);
      await refresh();
    } else {
      setError(result.error ?? { title: "Delete failed", detail: "Unknown error" });
    }
  }

  function updateEpisode(episodeId: string, patch: Partial<EpisodePlan>) {
    if (!selected) return;
    const episodes = selected.episodes.map((e) => (e.id === episodeId ? { ...e, ...patch } : e));
    void persist({ ...selected, episodes });
  }

  function addEpisode() {
    if (!selected) return;
    const episode: EpisodePlan = {
      id: generateId("episode"),
      order: selected.episodes.length + 1,
      title: "New Episode",
      learningOutcomes: [],
      prerequisites: [],
      difficulty: "beginner",
      requiredDemonstrations: [],
      dependsOnEpisodeIds: [],
      status: "idea",
    };
    void persist({ ...selected, episodes: [...selected.episodes, episode] });
  }

  function moveEpisode(index: number, direction: -1 | 1) {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.episodes.length) return;
    const episodes = [...selected.episodes];
    const [moved] = episodes.splice(index, 1);
    episodes.splice(target, 0, moved!);
    const renumbered = episodes.map((e, i) => ({ ...e, order: i + 1 }));
    void persist({ ...selected, episodes: renumbered });
  }

  function removeEpisode(episodeId: string) {
    if (!selected) return;
    const episodes = selected.episodes
      .filter((e) => e.id !== episodeId)
      .map((e, i) => ({ ...e, order: i + 1 }));
    void persist({ ...selected, episodes });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Series &amp; Curriculum Planner</h1>
            <p className="text-sm text-silver">Plan multiple related productions as a season or course.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleNewSeries}
              className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
            >
              New Series
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="rounded-md bg-bronze px-3 py-2 text-sm font-medium text-navy"
            >
              Load Orbit Sample Curriculum
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0 space-y-1">
            {series.length === 0 && <p className="text-sm text-silver">No series yet.</p>}
            {series.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  s.id === selectedId ? "bg-electric-blue/15 text-electric-blue" : "text-silver hover:bg-white/5"
                }`}
              >
                {s.title}
                <span className="ml-2 text-xs opacity-60">({s.episodes.length})</span>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-charcoal p-4">
                <input
                  value={selected.title}
                  onChange={(e) => void persist({ ...selected, title: e.target.value })}
                  className="flex-1 bg-transparent text-lg font-semibold text-cream focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(selected.id)}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete Series
                </button>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="font-medium text-cream">Episodes</h2>
                <button
                  type="button"
                  onClick={addEpisode}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-cream hover:bg-white/5"
                >
                  + Add Episode
                </button>
              </div>

              <div className="space-y-3">
                {selected.episodes.map((episode, index) => (
                  <div key={episode.id} className="rounded-lg border border-white/10 bg-charcoal p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <input
                        value={episode.title}
                        onChange={(e) => updateEpisode(episode.id, { title: e.target.value })}
                        className="flex-1 bg-transparent font-medium text-cream focus-visible:outline-none"
                      />
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <span className="mr-2 rounded bg-white/5 px-2 py-1 text-xs text-silver">
                          {episode.status}
                        </span>
                        <button
                          type="button"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() => moveEpisode(index, -1)}
                          className="rounded px-2 py-1 text-xs text-silver hover:bg-white/10 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          disabled={index === selected.episodes.length - 1}
                          onClick={() => moveEpisode(index, 1)}
                          className="rounded px-2 py-1 text-xs text-silver hover:bg-white/10 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label="Remove episode"
                          onClick={() => removeEpisode(episode.id)}
                          className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={episode.objective ?? ""}
                      onChange={(e) => updateEpisode(episode.id, { objective: e.target.value })}
                      placeholder="Learning objective"
                      rows={2}
                      className="mb-2 w-full rounded-md border border-white/10 bg-navy px-3 py-2 text-sm text-cream focus-visible:outline-none"
                    />
                    <div className="flex flex-wrap gap-3 text-xs text-silver">
                      <label className="flex items-center gap-1">
                        Difficulty
                        <select
                          value={episode.difficulty}
                          onChange={(e) =>
                            updateEpisode(episode.id, { difficulty: e.target.value as EpisodePlan["difficulty"] })
                          }
                          className="rounded border border-white/10 bg-navy px-2 py-1 text-cream"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1">
                        Status
                        <select
                          value={episode.status}
                          onChange={(e) =>
                            updateEpisode(episode.id, { status: e.target.value as EpisodePlan["status"] })
                          }
                          className="rounded border border-white/10 bg-navy px-2 py-1 text-cream"
                        >
                          <option value="idea">Idea</option>
                          <option value="in-progress">In Progress</option>
                          <option value="ready">Ready</option>
                          <option value="produced">Produced</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              {saving && <p className="text-xs text-silver">Saving...</p>}
            </div>
          ) : (
            <p className="text-sm text-silver">Select or create a series to begin planning.</p>
          )}
        </div>
      </main>
    </div>
  );
}
