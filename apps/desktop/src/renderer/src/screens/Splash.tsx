import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Wordmark";
import { useAppStore } from "../state/appStore";

interface StartupInfo {
  version: string;
  isPackaged: boolean;
  statusLog: Array<{ message: string; atIso: string }>;
  recoveryDetected: boolean;
  logFilePath: string;
}

export function Splash(): JSX.Element {
  const navigate = useNavigate();
  const loadSettings = useAppStore((s) => s.loadSettings);
  const [info, setInfo] = useState<StartupInfo | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    window.aether.getStartupInfo().then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!info) return;
    if (visibleCount >= info.statusLog.length) {
      const timer = setTimeout(async () => {
        await loadSettings();
        const settings = useAppStore.getState().settings;
        navigate(settings?.onboardingCompleted ? "/home" : "/onboarding", { replace: true });
      }, 400);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), 220);
    return () => clearTimeout(timer);
  }, [info, visibleCount, navigate, loadSettings]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-navy">
      <Wordmark size="lg" showTagline />
      <p className="text-silver">Plan it. Create it. Animate it. Deliver it.</p>

      <div className="h-10 w-2 animate-pulse-slow rounded-full bg-electric-blue" aria-hidden="true" />

      <div className="min-h-[7rem] w-96 space-y-1 text-center text-sm text-silver">
        {info?.statusLog.slice(0, visibleCount).map((entry, i) => (
          <p key={i} className={i === visibleCount - 1 ? "text-cream" : "opacity-60"}>
            {entry.message}
          </p>
        ))}
      </div>

      {info?.recoveryDetected && (
        <div className="rounded-md border border-bronze/50 bg-bronze/10 px-4 py-2 text-xs text-bronze">
          Safe mode: the previous session may not have closed cleanly. Recovery snapshots will be checked
          when you open a production.
        </div>
      )}

      {info && <p className="text-xs text-silver/50">Version {info.version}</p>}
    </div>
  );
}
