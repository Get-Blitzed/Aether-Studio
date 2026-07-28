import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Wordmark";
import { useAppStore } from "../state/appStore";
import { toAbsoluteFileUrl } from "../lib/fileUrl";

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
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const [introAudioUrl, setIntroAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.aether.getStartupInfo().then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One-time voice intro, played once per app launch (this component only
  // mounts once on Splash). Best-effort: if synthesis failed (no native
  // voices installed, non-Windows host), getIntroAudio() reports failure
  // and the splash simply proceeds silently.
  useEffect(() => {
    let cancelled = false;
    window.aether.getIntroAudio().then((result) => {
      if (!cancelled && result.ok) setIntroAudioUrl(toAbsoluteFileUrl(result.filePath));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (introAudioUrl) void introAudioRef.current?.play().catch(() => undefined);
  }, [introAudioUrl]);

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
    <div className="relative flex h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-navy">
      <div
        className="pointer-events-none absolute h-96 w-96 rounded-full bg-aurora-pink/10 blur-3xl"
        style={{ top: "10%", left: "15%" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute h-80 w-80 rounded-full bg-aurora-cyan/10 blur-3xl"
        style={{ bottom: "10%", right: "15%" }}
        aria-hidden="true"
      />

      {introAudioUrl && <audio ref={introAudioRef} src={introAudioUrl} />}

      <Wordmark size="lg" showTagline />
      <p className="text-silver">Plan it. Create it. Animate it. Deliver it.</p>

      <div className="h-10 w-2 animate-pulse-slow rounded-full bg-gradient-to-b from-electric-blue to-aurora-pink" aria-hidden="true" />

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
