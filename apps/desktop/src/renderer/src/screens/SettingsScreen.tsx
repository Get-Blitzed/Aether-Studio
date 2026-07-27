import { useEffect, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { useAppStore } from "../state/appStore";
import type { AppSettings } from "@aether/shared-types";

export function SettingsScreen(): JSX.Element {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [local, setLocal] = useState<AppSettings | null>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setLocal(settings), [settings]);

  if (!local) return <div className="p-8 text-cream">Loading...</div>;

  async function handleSave() {
    if (!local) return;
    const saved = await window.aether.settings.save(local);
    setSettings(saved);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleChooseFolder() {
    const folder = await window.aether.projects.chooseParentFolder();
    if (folder && local) setLocal({ ...local, defaultProjectFolder: folder });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="mb-6 text-2xl font-semibold text-cream">Settings</h1>

        <div className="max-w-xl space-y-6">
          <Field label="Appearance">
            <select
              value={local.appearance}
              onChange={(e) => setLocal({ ...local, appearance: e.target.value as AppSettings["appearance"] })}
              className="w-full rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">Match system</option>
            </select>
          </Field>

          <Field label="Default project folder" help="Where new productions are created unless you choose another location.">
            <div className="flex gap-2">
              <input
                readOnly
                value={local.defaultProjectFolder ?? "(Documents/Aether Studio Suite)"}
                className="flex-1 rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-silver"
              />
              <button
                type="button"
                onClick={handleChooseFolder}
                className="rounded-md border border-white/20 px-3 py-2 text-sm text-cream hover:bg-white/5"
              >
                Choose...
              </button>
            </div>
          </Field>

          <Field label="Autosave interval (seconds)">
            <input
              type="number"
              min={10}
              value={local.autosaveIntervalSeconds}
              onChange={(e) => setLocal({ ...local, autosaveIntervalSeconds: Number(e.target.value) })}
              className="w-32 rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
            />
          </Field>

          <Field label="Rolling backups to keep">
            <input
              type="number"
              min={1}
              value={local.backupCount}
              onChange={(e) => setLocal({ ...local, backupCount: Number(e.target.value) })}
              className="w-32 rounded-md border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
            />
          </Field>

          <Field label="Offline mode" help="Disables all external AI-provider calls when enabled.">
            <label className="flex items-center gap-2 text-sm text-silver">
              <input
                type="checkbox"
                checked={local.offlineMode}
                onChange={(e) => setLocal({ ...local, offlineMode: e.target.checked })}
              />
              Work offline (no external provider calls)
            </label>
          </Field>

          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy"
          >
            {saved ? "Saved" : "Save Settings"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-cream">{label}</label>
      {help && <p className="mb-2 text-xs text-silver">{help}</p>}
      {children}
    </div>
  );
}
