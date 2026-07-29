import { useEffect, useRef, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { toFileUrl } from "../lib/fileUrl";

const PRIVACY_CHECKLIST_ITEMS = [
  "Close confidential windows",
  "Hide private email addresses",
  "Hide phone numbers",
  "Hide account numbers",
  "Conceal API keys",
  "Disable personal notifications",
  "Use demonstration accounts",
  "Remove confidential documents",
  "Confirm the correct monitor/window is selected",
];

type RecordingState = "idle" | "countdown" | "recording" | "paused" | "saving";

interface CaptureSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  kind: "screen" | "window";
}

export function ScreenCaptureStudio(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>(PRIVACY_CHECKLIST_ITEMS.map(() => false));
  const [micEnabled, setMicEnabled] = useState(false);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const tracksRef = useRef<MediaStreamTrack[]>([]);
  const chunksRef = useRef<Blob[]>([]);

  const allChecked = checklist.every(Boolean);

  useEffect(() => {
    window.aether.screenCapture.listSources().then(setSources);
  }, []);

  useEffect(() => {
    return () => {
      tracksRef.current.forEach((t) => t.stop());
    };
  }, []);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="screen recordings" />;

  const recordings = currentManifest.assets.filter((a) => a.category === "screen-recordings");

  function toggleChecklistItem(index: number) {
    setChecklist((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  async function beginCapture() {
    if (!selectedSourceId || !allChecked || !currentProjectDir) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(timer);
          void startRecording();
          return null;
        }
        return c - 1;
      });
    }, 1000);
    setRecordingState("countdown");
  }

  async function startRecording() {
    if (!selectedSourceId) return;
    try {
      const source = sources.find((s) => s.id === selectedSourceId);
      const videoConstraints: MediaTrackConstraints = {
        // Electron/Chromium's legacy desktopCapturer constraint shape --
        // not part of the standard MediaTrackConstraints type.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: selectedSourceId,
        },
      } as unknown as MediaTrackConstraints;

      let videoStream: MediaStream;
      let gotSystemAudio = false;
      if (systemAudioEnabled && source?.kind === "screen") {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              mandatory: { chromeMediaSource: "desktop" },
            } as unknown as MediaTrackConstraints,
          });
          gotSystemAudio = videoStream.getAudioTracks().length > 0;
        } catch {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        }
      } else {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      }

      let micStream: MediaStream | null = null;
      if (micEnabled) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
          console.warn("Microphone capture unavailable", err);
        }
      }

      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
      if (gotSystemAudio) tracks.push(...videoStream.getAudioTracks());
      if (micStream) tracks.push(...micStream.getAudioTracks());
      tracksRef.current = tracks;

      const combined = new MediaStream(tracks);
      const recorder = new MediaRecorder(combined, { mimeType: "video/webm;codecs=vp9,opus" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void handleSaveRecording(gotSystemAudio, source?.kind ?? "screen");
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecordingState("recording");
    } catch (err) {
      setError({
        title: "Could not start recording",
        detail: err instanceof Error ? err.message : String(err),
      });
      setRecordingState("idle");
    }
  }

  function pauseRecording() {
    recorderRef.current?.pause();
    setRecordingState("paused");
  }

  function resumeRecording() {
    recorderRef.current?.resume();
    setRecordingState("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function handleSaveRecording(systemAudioCaptured: boolean, sourceKind: "screen" | "window") {
    setRecordingState("saving");
    tracksRef.current.forEach((t) => t.stop());
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const arrayBuffer = await blob.arrayBuffer();

    const result = await window.aether.screenCapture.saveRecording({
      projectDir: currentProjectDir!,
      data: arrayBuffer,
      fileExtension: "webm",
      sourceKind,
      micEnabled,
      systemAudioEnabled: systemAudioCaptured,
      privacyChecklistAcknowledged: allChecked,
    });
    setRecordingState("idle");
    if (result.ok) {
      setCurrentProject(currentProjectDir!, result.manifest);
    } else {
      setError(result.error ?? { title: "Save failed", detail: "Unknown error" });
    }
  }

  async function handleProcessClip(assetId: string, action: "trim" | "speed", start?: number, end?: number, speed?: number) {
    if (!currentProjectDir) return;
    const args =
      action === "trim"
        ? ({ projectDir: currentProjectDir, assetId, action: "trim" as const, trimStartSeconds: start ?? 0, trimEndSeconds: end ?? 0 })
        : ({ projectDir: currentProjectDir, assetId, action: "speed" as const, speedFactor: speed ?? 1 });
    const result = await window.aether.screenCapture.processClip(args);
    if (result.ok) setCurrentProject(currentProjectDir, result.manifest);
    else setError(result.error ?? { title: "Processing failed", detail: "Unknown error" });
  }

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-cream">Screen Capture Studio</h1>
          <p className="text-sm text-silver">Record and organize software demonstrations for {currentManifest.title}.</p>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-bronze/40 bg-bronze/5 p-5">
            <h2 className="mb-3 font-medium text-cream">Privacy Checklist</h2>
            <p className="mb-3 text-xs text-silver">
              These are manual checks, not automatic detection -- the app does not scan your screen for secrets. Confirm
              each item yourself before recording.
            </p>
            <div className="space-y-2">
              {PRIVACY_CHECKLIST_ITEMS.map((item, i) => (
                <label key={item} className="flex items-center gap-2 text-sm text-silver">
                  <input type="checkbox" checked={checklist[i]} onChange={() => toggleChecklistItem(i)} />
                  {item}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-hairline/10 bg-charcoal p-5">
            <h2 className="mb-3 font-medium text-cream">Capture Source</h2>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {sources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSourceId(s.id)}
                  className={`rounded-md border p-1 text-left ${
                    s.id === selectedSourceId ? "border-electric-blue" : "border-hairline/10 hover:border-hairline/30"
                  }`}
                >
                  <img src={s.thumbnailDataUrl} alt={s.name} className="mb-1 h-16 w-full rounded object-cover" />
                  <p className="truncate px-1 text-xs text-silver">{s.name}</p>
                </button>
              ))}
              {sources.length === 0 && <p className="col-span-2 text-sm text-silver">Loading sources...</p>}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-silver">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)} />
                Microphone
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={systemAudioEnabled}
                  onChange={(e) => setSystemAudioEnabled(e.target.checked)}
                />
                System audio (best effort -- not guaranteed on every system)
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {recordingState === "idle" && (
                <button
                  type="button"
                  disabled={!allChecked || !selectedSourceId}
                  onClick={beginCapture}
                  className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-40"
                  title={!allChecked ? "Complete the privacy checklist first" : !selectedSourceId ? "Choose a source" : ""}
                >
                  Start Recording
                </button>
              )}
              {recordingState === "countdown" && (
                <span className="text-2xl font-semibold text-bronze">{countdown}</span>
              )}
              {recordingState === "recording" && (
                <>
                  <span className="flex items-center gap-2 text-sm text-red-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Recording
                  </span>
                  <button type="button" onClick={pauseRecording} className="rounded-md border border-hairline/20 px-3 py-1.5 text-xs text-cream hover:bg-hairline/5">
                    Pause
                  </button>
                  <button type="button" onClick={stopRecording} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                    Stop
                  </button>
                </>
              )}
              {recordingState === "paused" && (
                <>
                  <span className="text-sm text-silver">Paused</span>
                  <button type="button" onClick={resumeRecording} className="rounded-md border border-hairline/20 px-3 py-1.5 text-xs text-cream hover:bg-hairline/5">
                    Resume
                  </button>
                  <button type="button" onClick={stopRecording} className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
                    Stop
                  </button>
                </>
              )}
              {recordingState === "saving" && <span className="text-sm text-silver">Saving to Asset Library...</span>}
            </div>
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-medium text-cream">Recordings ({recordings.length})</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recordings.map((asset) => (
              <RecordingCard
                key={asset.id}
                asset={asset}
                projectDir={currentProjectDir}
                onTrim={(start, end) => handleProcessClip(asset.id, "trim", start, end)}
                onSpeed={(factor) => handleProcessClip(asset.id, "speed", undefined, undefined, factor)}
              />
            ))}
            {recordings.length === 0 && <p className="text-sm text-silver">No recordings yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

function RecordingCard({
  asset,
  projectDir,
  onTrim,
  onSpeed,
}: {
  asset: { id: string; originalFileName: string; filePath: string; thumbnailPath?: string; durationSeconds?: number; notes?: string };
  projectDir: string;
  onTrim: (start: number, end: number) => void;
  onSpeed: (factor: number) => void;
}): JSX.Element {
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState(asset.durationSeconds ? asset.durationSeconds.toFixed(1) : "");
  const [speed, setSpeed] = useState("1");

  return (
    <div className="rounded-lg border border-hairline/10 bg-charcoal p-3">
      <video controls src={toFileUrl(projectDir, asset.filePath)} className="mb-2 h-32 w-full rounded bg-navy object-contain" />
      <p className="mb-1 truncate text-xs text-cream">{asset.originalFileName}</p>
      {asset.durationSeconds !== undefined && <p className="mb-2 text-xs text-silver">{asset.durationSeconds.toFixed(1)}s</p>}
      <div className="mb-2 flex items-center gap-1 text-xs text-silver">
        Trim
        <input value={start} onChange={(e) => setStart(e.target.value)} className="w-14 rounded border border-hairline/10 bg-navy px-1 py-0.5 text-cream" />
        to
        <input value={end} onChange={(e) => setEnd(e.target.value)} className="w-14 rounded border border-hairline/10 bg-navy px-1 py-0.5 text-cream" />
        <button type="button" onClick={() => onTrim(Number(start), Number(end))} className="rounded border border-hairline/20 px-2 py-0.5 text-cream hover:bg-hairline/5">
          Apply
        </button>
      </div>
      <div className="flex items-center gap-1 text-xs text-silver">
        Speed
        <input value={speed} onChange={(e) => setSpeed(e.target.value)} className="w-14 rounded border border-hairline/10 bg-navy px-1 py-0.5 text-cream" />
        <button type="button" onClick={() => onSpeed(Number(speed))} className="rounded border border-hairline/20 px-2 py-0.5 text-cream hover:bg-hairline/5">
          Apply
        </button>
      </div>
      {asset.notes && <p className="mt-2 text-[10px] italic text-silver/70">{asset.notes}</p>}
    </div>
  );
}
