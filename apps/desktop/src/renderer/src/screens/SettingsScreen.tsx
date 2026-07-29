import { useEffect, useRef, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { useAppStore } from "../state/appStore";
import { applyAppearance } from "../lib/theme";
import type { AppSettings } from "@aether/shared-types";

interface FfmpegStatus {
  ffmpegFound: boolean;
  ffmpegPath: string | null;
  ffprobeFound: boolean;
  ffprobePath: string | null;
  version: string | null;
}

export function SettingsScreen(): JSX.Element {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const [local, setLocal] = useState<AppSettings | null>(settings);
  const [saved, setSaved] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [checkingFfmpeg, setCheckingFfmpeg] = useState(false);

  useEffect(() => setLocal(settings), [settings]);

  // Revert any unsaved Appearance preview back to the persisted value if the
  // user navigates away without saving -- otherwise the live-previewed
  // choice would stay applied even though it was never actually saved. A
  // ref (rather than a `[settings]` dependency) keeps this cleanup
  // unmount-only while still reading whatever was most recently saved.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    return () => {
      if (settingsRef.current) applyAppearance(settingsRef.current.appearance);
    };
  }, []);

  async function handleTestFfmpeg() {
    setCheckingFfmpeg(true);
    const status = await window.aether.ffmpeg.status();
    setFfmpegStatus(status);
    setCheckingFfmpeg(false);
  }

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
              onChange={(e) => {
                const appearance = e.target.value as AppSettings["appearance"];
                setLocal({ ...local, appearance });
                applyAppearance(appearance);
              }}
              className="w-full rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream"
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
                className="flex-1 rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-silver"
              />
              <button
                type="button"
                onClick={handleChooseFolder}
                className="rounded-md border border-hairline/20 px-3 py-2 text-sm text-cream hover:bg-hairline/5"
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
              className="w-32 rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream"
            />
          </Field>

          <Field label="Rolling backups to keep">
            <input
              type="number"
              min={1}
              value={local.backupCount}
              onChange={(e) => setLocal({ ...local, backupCount: Number(e.target.value) })}
              className="w-32 rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream"
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

          <div className="border-t border-hairline/10 pt-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-silver">Advanced</h2>

            <Field
              label="FFmpeg path override"
              help="Leave blank to use the bundled FFmpeg. Only set this if you need a specific FFmpeg build."
            >
              <input
                value={local.ffmpegPath ?? ""}
                onChange={(e) => setLocal({ ...local, ffmpegPath: e.target.value || undefined })}
                placeholder="(using bundled FFmpeg)"
                className="w-full rounded-md border border-hairline/10 bg-charcoal px-3 py-2 text-sm text-cream focus-visible:outline-none"
              />
            </Field>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestFfmpeg}
                disabled={checkingFfmpeg}
                className="rounded-md border border-hairline/20 px-3 py-1.5 text-xs text-cream hover:bg-hairline/5 disabled:opacity-50"
              >
                {checkingFfmpeg ? "Checking..." : "Test FFmpeg"}
              </button>
              {ffmpegStatus && (
                <span className={`text-xs ${ffmpegStatus.ffmpegFound ? "text-emerald-300" : "text-red-300"}`}>
                  {ffmpegStatus.ffmpegFound
                    ? `Found: ${ffmpegStatus.version ?? ffmpegStatus.ffmpegPath}`
                    : "FFmpeg not found -- video thumbnails and audio waveforms will be unavailable."}
                </span>
              )}
            </div>
          </div>

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
