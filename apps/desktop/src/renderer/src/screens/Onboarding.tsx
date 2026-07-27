import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Wordmark";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";

type Choice = "blank" | "sample" | "import" | null;

async function markOnboardingComplete(): Promise<void> {
  const current = await window.aether.settings.get();
  await window.aether.settings.save({ ...current, onboardingCompleted: true });
}

export function Onboarding(): JSX.Element {
  const navigate = useNavigate();
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const lastError = useAppStore((s) => s.lastError);
  const setLastError = useAppStore((s) => s.setLastError);
  const [choice, setChoice] = useState<Choice>(null);
  const [title, setTitle] = useState("Untitled Production");
  const [busy, setBusy] = useState(false);

  async function finishWithProject(projectDir: string | undefined, manifest: unknown, error?: { title: string; detail: string }) {
    if (error || !projectDir) {
      setLastError(error ?? { title: "Something went wrong", detail: "No project was opened." });
      setBusy(false);
      return;
    }
    setCurrentProject(projectDir, manifest as never);
    await markOnboardingComplete();
    navigate("/production", { replace: true });
  }

  async function handleBlank() {
    setBusy(true);
    const result = await window.aether.projects.create({ title });
    await finishWithProject(result.ok ? result.projectDir : undefined, result.ok ? result.manifest : undefined, result.ok ? undefined : result.error);
  }

  async function handleSample() {
    setBusy(true);
    const result = await window.aether.projects.openSample();
    await finishWithProject(result.ok ? result.projectDir : undefined, result.ok ? result.manifest : undefined, result.ok ? undefined : result.error);
  }

  async function handleImport() {
    setBusy(true);
    const result = await window.aether.projects.chooseAndOpen();
    if (result.canceled) {
      setBusy(false);
      return;
    }
    await finishWithProject(result.ok ? result.projectDir : undefined, result.ok ? result.manifest : undefined, result.ok ? undefined : result.error);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-10 bg-navy px-8">
      <Wordmark size="lg" showTagline />

      {lastError && <ErrorBanner error={lastError} onDismiss={() => setLastError(null)} />}

      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        <OnboardingCard
          title="Start a Blank Production"
          description="Begin with an empty production and build it up from scratch."
          selected={choice === "blank"}
          onClick={() => setChoice("blank")}
        />
        <OnboardingCard
          title="Use the A.I. Blitz Sample Project"
          description="Explore a fully editable sample: Blitz character profile, brand, and the Mission 001 script."
          selected={choice === "sample"}
          onClick={() => setChoice("sample")}
        />
        <OnboardingCard
          title="Import an Existing Aether Project"
          description="Choose a folder containing an existing project.aether manifest."
          selected={choice === "import"}
          onClick={() => setChoice("import")}
        />
      </div>

      {choice === "blank" && (
        <div className="flex w-full max-w-md flex-col gap-3">
          <label htmlFor="title" className="text-sm text-silver">
            Production title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-white/10 bg-charcoal px-3 py-2 text-cream focus-visible:outline-none"
          />
          <button
            type="button"
            disabled={busy || title.trim().length === 0}
            onClick={handleBlank}
            className="rounded-md bg-electric-blue px-4 py-2 font-medium text-navy disabled:opacity-50"
          >
            {busy ? "Creating..." : "Create Production"}
          </button>
        </div>
      )}

      {choice === "sample" && (
        <button
          type="button"
          disabled={busy}
          onClick={handleSample}
          className="rounded-md bg-electric-blue px-4 py-2 font-medium text-navy disabled:opacity-50"
        >
          {busy ? "Loading sample..." : "Open A.I. Blitz Sample"}
        </button>
      )}

      {choice === "import" && (
        <button
          type="button"
          disabled={busy}
          onClick={handleImport}
          className="rounded-md bg-electric-blue px-4 py-2 font-medium text-navy disabled:opacity-50"
        >
          {busy ? "Opening..." : "Choose Project Folder"}
        </button>
      )}
    </div>
  );
}

function OnboardingCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-5 text-left transition-colors ${
        selected ? "border-electric-blue bg-electric-blue/10" : "border-white/10 bg-charcoal hover:border-white/30"
      }`}
    >
      <p className="font-semibold text-cream">{title}</p>
      <p className="mt-2 text-sm text-silver">{description}</p>
    </button>
  );
}
