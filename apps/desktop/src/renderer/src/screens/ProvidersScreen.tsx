import { useEffect, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { ErrorBanner } from "../components/ErrorBanner";
import { generateId, nowIso } from "../lib/ids";
import type { ProviderConfig, ProviderKind, ProviderCapability, BackgroundJob } from "@aether/shared-types";

const PROVIDER_KINDS: ProviderKind[] = ["mock", "openai-compatible", "generic-rest", "sapi-voice", "piper-voice", "elevenlabs"];
const CAPABILITIES: ProviderCapability[] = ["text", "image", "voice"];
const KINDS_NEEDING_CREDENTIALS = new Set<ProviderKind>(["openai-compatible", "generic-rest", "elevenlabs"]);

interface NewProviderForm {
  name: string;
  kind: ProviderKind;
  capability: ProviderCapability;
  baseUrl: string;
  model: string;
  requestTemplate: string;
  secret: string;
}

const BLANK_FORM: NewProviderForm = {
  name: "",
  kind: "mock",
  capability: "text",
  baseUrl: "",
  model: "",
  requestTemplate: "",
  secret: "",
};

export function ProvidersScreen(): JSX.Element {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewProviderForm>(BLANK_FORM);

  const refresh = async () => {
    const [providerList, jobList] = await Promise.all([window.aether.providers.list(), window.aether.providers.listJobs()]);
    setProviders(providerList);
    setJobs(jobList);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddProvider() {
    if (!form.name.trim()) {
      setError({ title: "Name required", detail: "Give the provider a name before saving." });
      return;
    }
    setSaving(true);
    const timestamp = nowIso();
    const config: Omit<ProviderConfig, "hasSecret"> = {
      id: generateId("provider"),
      name: form.name.trim(),
      kind: form.kind,
      capability: form.capability,
      baseUrl: form.baseUrl.trim() || undefined,
      model: form.model.trim() || undefined,
      requestTemplate: form.requestTemplate.trim() || undefined,
      enabled: true,
      isDefaultForCapability: providers.filter((p) => p.capability === form.capability).length === 0,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    const result = await window.aether.providers.save({ config, secret: form.secret || undefined });
    setSaving(false);
    if (result.ok) {
      setForm(BLANK_FORM);
      await refresh();
    } else {
      setError(result.error ?? { title: "Save failed", detail: "Unknown error" });
    }
  }

  async function handleSetDefault(provider: ProviderConfig) {
    const result = await window.aether.providers.save({
      config: { ...provider, isDefaultForCapability: true, modifiedAt: nowIso() },
      secret: undefined,
    });
    if (result.ok) await refresh();
    else setError(result.error ?? { title: "Update failed", detail: "Unknown error" });
  }

  async function handleToggleEnabled(provider: ProviderConfig) {
    const result = await window.aether.providers.save({
      config: { ...provider, enabled: !provider.enabled, modifiedAt: nowIso() },
      secret: undefined,
    });
    if (result.ok) await refresh();
    else setError(result.error ?? { title: "Update failed", detail: "Unknown error" });
  }

  async function handleRemove(id: string) {
    const result = await window.aether.providers.remove(id);
    if (result.ok) await refresh();
    else setError(result.error ?? { title: "Remove failed", detail: "Unknown error" });
  }

  async function handleTest(id: string) {
    setTestingId(id);
    const result = await window.aether.providers.test(id);
    setTestingId(null);
    if (result.ok) {
      setTestResults((prev) => ({ ...prev, [id]: result.result }));
    } else {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, message: result.error?.detail ?? "Unknown error" } }));
    }
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-cream">Provider &amp; Plugin Manager</h1>
          <p className="text-sm text-silver">
            Configure AI providers for text, image, and voice generation. The Mock and native Windows voice (SAPI)
            providers work offline with no credentials; other providers require an API key and are blocked while
            Settings &gt; Offline Mode is on.
          </p>
        </header>

        {error && (
          <div className="mb-6">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <section className="mb-8 rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Configured Providers</h2>
          {providers.length === 0 && <p className="text-sm text-silver">No providers configured yet. Add one below.</p>}
          <div className="space-y-3">
            {providers.map((provider) => (
              <div key={provider.id} className="rounded-md border border-white/10 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-cream">{provider.name}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-silver">{provider.kind}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-silver">{provider.capability}</span>
                    {provider.isDefaultForCapability && (
                      <span className="rounded bg-electric-blue/15 px-2 py-0.5 text-xs text-electric-blue">
                        default for {provider.capability}
                      </span>
                    )}
                    {!provider.enabled && <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">disabled</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!provider.isDefaultForCapability && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(provider)}
                        className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5"
                      >
                        Set as default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleEnabled(provider)}
                      className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5"
                    >
                      {provider.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTest(provider.id)}
                      disabled={testingId === provider.id}
                      className="rounded border border-electric-blue/50 px-2 py-1 text-xs text-electric-blue hover:bg-electric-blue/10 disabled:opacity-50"
                    >
                      {testingId === provider.id ? "Testing..." : "Test Connection"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(provider.id)}
                      className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="text-xs text-silver">
                  {provider.baseUrl && <span>Base URL: {provider.baseUrl} &middot; </span>}
                  {provider.model && <span>Model: {provider.model} &middot; </span>}
                  <span>{provider.hasSecret ? "API key stored (encrypted)" : "No API key stored"}</span>
                </div>
                {testResults[provider.id] && (
                  <p className={`mt-2 text-xs ${testResults[provider.id]!.ok ? "text-emerald-300" : "text-red-300"}`}>
                    {testResults[provider.id]!.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Add Provider</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <label className="text-xs text-silver">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
              />
            </label>
            <label className="text-xs text-silver">
              Kind
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ProviderKind }))}
                className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
              >
                {PROVIDER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-silver">
              Capability
              <select
                value={form.capability}
                onChange={(e) => setForm((f) => ({ ...f, capability: e.target.value as ProviderCapability }))}
                className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
              >
                {CAPABILITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {form.kind === "sapi-voice" && (
              <p className="col-span-2 text-xs text-silver md:col-span-3">
                Native Windows text-to-speech (System.Speech). Fully offline, no API key or base URL needed -- whatever
                voices are installed on this machine will be available.
              </p>
            )}
            {form.kind === "piper-voice" && (
              <p className="col-span-2 text-xs text-silver md:col-span-3">
                Bundled offline neural voices (Piper). Fully offline, no API key or base URL needed -- four curated
                voices ship with the app, the same on every machine, and generally sound more natural than SAPI while
                staying free.
              </p>
            )}
            {KINDS_NEEDING_CREDENTIALS.has(form.kind) && (
              <>
                <label className="text-xs text-silver">
                  Base URL
                  <input
                    value={form.baseUrl}
                    onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                    placeholder={form.kind === "elevenlabs" ? "https://api.elevenlabs.io/v1" : "https://api.openai.com/v1"}
                    className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                  />
                </label>
                {form.kind === "openai-compatible" && (
                  <label className="text-xs text-silver">
                    Model
                    <input
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      placeholder="gpt-4o-mini"
                      className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                    />
                  </label>
                )}
                <label className="text-xs text-silver">
                  API Key
                  <input
                    type="password"
                    value={form.secret}
                    onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                    className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-sm text-cream"
                  />
                </label>
                {form.kind === "generic-rest" && (
                  <label className="col-span-2 text-xs text-silver md:col-span-3">
                    Request template (JSON, use {"{{prompt}}"})
                    <textarea
                      value={form.requestTemplate}
                      onChange={(e) => setForm((f) => ({ ...f, requestTemplate: e.target.value }))}
                      placeholder='{"prompt": "{{prompt}}"}'
                      rows={2}
                      className="mt-1 block w-full rounded-md border border-white/10 bg-navy px-2 py-1.5 text-xs text-cream"
                    />
                  </label>
                )}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddProvider}
            disabled={saving}
            className="mt-4 rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
          >
            {saving ? "Saving..." : "+ Add Provider"}
          </button>
        </section>

        <section className="rounded-lg border border-white/10 bg-charcoal p-5">
          <h2 className="mb-3 font-medium text-cream">Recent Jobs</h2>
          {jobs.length === 0 && <p className="text-sm text-silver">No AI jobs run yet.</p>}
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-cream">{job.jobType}</span>
                  <span className="text-silver">{job.providerName ?? job.providerId ?? "unknown provider"}</span>
                  <span
                    className={
                      job.status === "completed"
                        ? "rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-300"
                        : job.status === "failed"
                          ? "rounded bg-red-500/15 px-2 py-0.5 text-red-300"
                          : "rounded bg-white/10 px-2 py-0.5 text-silver"
                    }
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-silver">
                  {job.usage && (
                    <span>
                      {job.usage.promptTokens + job.usage.completionTokens} tokens (est. ${job.usage.estimatedCostUsd.toFixed(4)}) &middot;{" "}
                    </span>
                  )}
                  {job.error && <span className="text-red-300">{job.error}</span>}
                  <span>{new Date(job.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
