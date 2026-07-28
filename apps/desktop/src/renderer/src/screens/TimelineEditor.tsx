import { useEffect, useMemo, useRef, useState } from "react";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";
import { generateId, nowIso } from "../lib/ids";
import { toFileUrl } from "../lib/fileUrl";
import { TRACK_TYPES, trackAssetKind, assetMatchesTrack, isOverlayTrack, isCaptionsTrack, isBlurTrack, formatTimecode } from "../lib/timelineHelpers";
import { buildStandardOverlayTemplates } from "../lib/overlayTemplateSeed";
import type { Timeline, TimelineTrack, TimelineClip, TimelineTrackType, ProjectManifest } from "@aether/shared-types";

const PIXELS_PER_SECOND_STEPS = [10, 20, 40, 80, 160];

function findActiveClip(clips: TimelineClip[], trackId: string, atSeconds: number): TimelineClip | undefined {
  return clips.find(
    (c) => c.trackId === trackId && atSeconds >= c.timelineStartSeconds && atSeconds < c.timelineStartSeconds + c.timelineDurationSeconds,
  );
}

function clipOpacity(clip: TimelineClip, atSeconds: number): number {
  const elapsed = atSeconds - clip.timelineStartSeconds;
  const remaining = clip.timelineStartSeconds + clip.timelineDurationSeconds - atSeconds;
  if (clip.fadeInSeconds > 0 && elapsed < clip.fadeInSeconds) return Math.max(0, elapsed / clip.fadeInSeconds);
  if (clip.fadeOutSeconds > 0 && remaining < clip.fadeOutSeconds) return Math.max(0, remaining / clip.fadeOutSeconds);
  return 1;
}

const POSITION_STYLES: Record<string, string> = {
  "top-left": "top-4 left-4 items-start text-left",
  "top-center": "top-4 left-1/2 -translate-x-1/2 items-center text-center",
  "top-right": "top-4 right-4 items-end text-right",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 items-center text-center",
  "bottom-left": "bottom-10 left-4 items-start text-left",
  "bottom-center": "bottom-10 left-1/2 -translate-x-1/2 items-center text-center",
  "bottom-right": "bottom-10 right-4 items-end text-right",
};

export function TimelineEditor(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const updateAndSave = useAppStore((s) => s.updateAndSave);

  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(currentManifest?.timelines[0]?.id ?? null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pixelsPerSecondIndex, setPixelsPerSecondIndex] = useState(2);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderNotice, setRenderNotice] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Timeline[]>([]);
  const [redoStack, setRedoStack] = useState<Timeline[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  const timelines = currentManifest?.timelines ?? [];
  const timeline = timelines.find((t) => t.id === selectedTimelineId) ?? null;
  const pixelsPerSecond = PIXELS_PER_SECOND_STEPS[pixelsPerSecondIndex]!;

  const sortedTracks = useMemo(() => [...(timeline?.tracks ?? [])].sort((a, b) => a.order - b.order), [timeline]);
  const anySolo = sortedTracks.some((t) => t.solo);
  const totalDuration = Math.max(30, ...(timeline?.clips.map((c) => c.timelineStartSeconds + c.timelineDurationSeconds) ?? [0]));

  // Playback clock: a simple wall-clock rAF loop drives the shared playhead;
  // media elements follow it (seek on clip change, periodic drift
  // correction) rather than the other way around. See KNOWN_LIMITATIONS.md
  // for why this isn't frame-accurate broadcast sync.
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPlayheadSeconds((p) => {
        const next = p + delta;
        if (next >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalDuration]);

  const primaryVideoTrack = sortedTracks.find((t) => t.type === "primary-video");
  const activeVideoClip = primaryVideoTrack && timeline ? findActiveClip(timeline.clips, primaryVideoTrack.id, playheadSeconds) : undefined;
  const activeVideoAsset = activeVideoClip && currentManifest ? currentManifest.assets.find((a) => a.id === activeVideoClip.assetId) : undefined;

  // Seek/play the preview <video> when the active clip changes; drift-correct otherwise.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideoClip) return;
    const expected = playheadSeconds - activeVideoClip.timelineStartSeconds + activeVideoClip.sourceInSeconds;
    if (Math.abs(el.currentTime - expected) > 0.3) el.currentTime = expected;
    if (isPlaying) void el.play().catch(() => undefined);
    else el.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoClip?.id, isPlaying]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideoClip) return;
    const expected = playheadSeconds - activeVideoClip.timelineStartSeconds + activeVideoClip.sourceInSeconds;
    if (Math.abs(el.currentTime - expected) > 0.3) el.currentTime = expected;
  }, [playheadSeconds, activeVideoClip]);

  // Sync narration/music/sound-effects tracks the same way, one <audio> element per track.
  const audioTracks = sortedTracks.filter((t) => trackAssetKind(t.type) === "audio");
  useEffect(() => {
    if (!timeline) return;
    for (const track of audioTracks) {
      const el = audioRefs.current.get(track.id);
      if (!el) continue;
      const activeClip = findActiveClip(timeline.clips, track.id, playheadSeconds);
      if (!activeClip) {
        el.pause();
        continue;
      }
      const expected = playheadSeconds - activeClip.timelineStartSeconds + activeClip.sourceInSeconds;
      if (Math.abs(el.currentTime - expected) > 0.3) el.currentTime = expected;
      const silencedBySolo = anySolo && !track.solo;
      el.volume = Math.min(1, Math.max(0, activeClip.volume));
      el.muted = track.muted || activeClip.muted || silencedBySolo;
      if (isPlaying) void el.play().catch(() => undefined);
      else el.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadSeconds, isPlaying, timeline, anySolo]);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="the timeline" />;

  function pushUndo() {
    if (timeline) {
      setUndoStack((s) => [...s, timeline]);
      setRedoStack([]);
    }
  }

  async function mutateTimeline(updater: (t: Timeline) => Timeline) {
    if (!timeline) return;
    const updated = updater(timeline);
    await updateAndSave((m: ProjectManifest) => ({
      ...m,
      timelines: m.timelines.map((t) => (t.id === timeline.id ? { ...updated, modifiedAt: nowIso() } : t)),
    }));
  }

  async function handleAddTimeline() {
    const timestamp = nowIso();
    const newTimeline: Timeline = {
      id: generateId("timeline"),
      name: `Timeline ${timelines.length + 1}`,
      aspectRatio: "16:9",
      frameRate: 30,
      tracks: [
        { id: generateId("track"), type: "primary-video", name: "Primary Video", order: 0, muted: false, solo: false, locked: false },
        { id: generateId("track"), type: "narration", name: "Narration", order: 1, muted: false, solo: false, locked: false },
      ],
      clips: [],
      markers: [],
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    await updateAndSave((m) => ({ ...m, timelines: [...m.timelines, newTimeline] }));
    setSelectedTimelineId(newTimeline.id);
  }

  async function handleLoadStandardOverlays() {
    await updateAndSave((m) => {
      const existingKinds = new Set(m.overlayTemplates.map((o) => o.kind));
      const toAdd = buildStandardOverlayTemplates().filter((o) => !existingKinds.has(o.kind));
      return { ...m, overlayTemplates: [...m.overlayTemplates, ...toAdd] };
    });
    setRenderNotice("Standard overlay templates loaded (skipped any already present).");
  }

  async function handleAddTrack(type: TimelineTrackType) {
    if (!timeline) return;
    pushUndo();
    const newTrack: TimelineTrack = {
      id: generateId("track"),
      type,
      name: type.replace(/-/g, " "),
      order: timeline.tracks.length,
      muted: false,
      solo: false,
      locked: false,
    };
    await mutateTimeline((t) => ({ ...t, tracks: [...t.tracks, newTrack] }));
  }

  function updateTrack(trackId: string, patch: Partial<TimelineTrack>) {
    if (!timeline) return;
    void mutateTimeline((t) => ({ ...t, tracks: t.tracks.map((tr) => (tr.id === trackId ? { ...tr, ...patch } : tr)) }));
  }

  function removeTrack(trackId: string) {
    if (!timeline) return;
    pushUndo();
    void mutateTimeline((t) => ({
      ...t,
      tracks: t.tracks.filter((tr) => tr.id !== trackId),
      clips: t.clips.filter((c) => c.trackId !== trackId),
    }));
  }

  function addClipToTrack(track: TimelineTrack, refId: string, kind: "asset" | "overlay", durationSeconds: number) {
    if (!timeline) return;
    pushUndo();
    const trackClips = timeline.clips.filter((c) => c.trackId === track.id);
    const start = trackClips.reduce((max, c) => Math.max(max, c.timelineStartSeconds + c.timelineDurationSeconds), 0);
    const timestamp = nowIso();
    const clip: TimelineClip = {
      id: generateId("clip"),
      trackId: track.id,
      assetId: kind === "asset" ? refId : undefined,
      overlayTemplateId: kind === "overlay" ? refId : undefined,
      sourceInSeconds: 0,
      sourceOutSeconds: kind === "asset" ? durationSeconds : undefined,
      timelineStartSeconds: start,
      timelineDurationSeconds: durationSeconds,
      volume: 1,
      opacity: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      muted: false,
      locked: false,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    void mutateTimeline((t) => ({ ...t, clips: [...t.clips, clip] }));
    setSelectedClipId(clip.id);
  }

  function addBlurClipToTrack(track: TimelineTrack) {
    if (!timeline) return;
    pushUndo();
    const trackClips = timeline.clips.filter((c) => c.trackId === track.id);
    const start = trackClips.reduce((max, c) => Math.max(max, c.timelineStartSeconds + c.timelineDurationSeconds), 0);
    const timestamp = nowIso();
    const clip: TimelineClip = {
      id: generateId("clip"),
      trackId: track.id,
      sourceInSeconds: 0,
      timelineStartSeconds: start,
      timelineDurationSeconds: 3,
      volume: 1,
      opacity: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      muted: false,
      locked: false,
      blurRegion: { xPercent: 35, yPercent: 35, widthPercent: 30, heightPercent: 30, blurStrength: 20 },
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    void mutateTimeline((t) => ({ ...t, clips: [...t.clips, clip] }));
    setSelectedClipId(clip.id);
  }

  function updateClip(clipId: string, patch: Partial<TimelineClip>) {
    if (!timeline) return;
    void mutateTimeline((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch, modifiedAt: nowIso() } : c)) }));
  }

  function removeClip(clipId: string) {
    if (!timeline) return;
    pushUndo();
    void mutateTimeline((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  }

  function duplicateClip(clip: TimelineClip) {
    if (!timeline) return;
    pushUndo();
    const timestamp = nowIso();
    const copy: TimelineClip = {
      ...clip,
      id: generateId("clip"),
      timelineStartSeconds: clip.timelineStartSeconds + clip.timelineDurationSeconds,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    void mutateTimeline((t) => ({ ...t, clips: [...t.clips, copy] }));
  }

  function splitClipAtPlayhead(clip: TimelineClip) {
    if (!timeline) return;
    const splitPoint = playheadSeconds - clip.timelineStartSeconds;
    if (splitPoint <= 0 || splitPoint >= clip.timelineDurationSeconds) return;
    pushUndo();
    const timestamp = nowIso();
    const first: TimelineClip = { ...clip, timelineDurationSeconds: splitPoint, sourceOutSeconds: clip.sourceInSeconds + splitPoint, modifiedAt: timestamp };
    const second: TimelineClip = {
      ...clip,
      id: generateId("clip"),
      timelineStartSeconds: clip.timelineStartSeconds + splitPoint,
      timelineDurationSeconds: clip.timelineDurationSeconds - splitPoint,
      sourceInSeconds: clip.sourceInSeconds + splitPoint,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    void mutateTimeline((t) => ({ ...t, clips: [...t.clips.filter((c) => c.id !== clip.id), first, second] }));
  }

  function handleUndo() {
    if (undoStack.length === 0 || !timeline) return;
    const previous = undoStack[undoStack.length - 1]!;
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, timeline]);
    void mutateTimeline(() => previous);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => (timeline ? [...s, timeline] : s));
    void mutateTimeline(() => next);
  }

  async function handleAddMarker() {
    if (!timeline) return;
    const label = window.prompt("Marker label", `Marker at ${formatTimecode(playheadSeconds)}`);
    if (!label) return;
    pushUndo();
    await mutateTimeline((t) => ({
      ...t,
      markers: [...t.markers, { id: generateId("marker"), timeSeconds: playheadSeconds, label }],
    }));
  }

  async function handleRenderPreview() {
    if (!timeline || !currentProjectDir) return;
    setRendering(true);
    setRenderNotice(null);
    const result = await window.aether.timeline.renderPreview({ projectDir: currentProjectDir, timelineId: timeline.id });
    setRendering(false);
    if (result.ok) {
      setCurrentProject(currentProjectDir, result.manifest);
      setRenderNotice("Preview rendered and added to the Asset Library (Exports category).");
    } else {
      setError(result.error ?? { title: "Render failed", detail: "Unknown error" });
    }
  }

  const selectedClip = timeline?.clips.find((c) => c.id === selectedClipId) ?? null;

  const activeOverlayClips = useMemo(() => {
    if (!timeline) return [];
    return sortedTracks
      .filter((t) => isOverlayTrack(t.type) && !isCaptionsTrack(t.type))
      .map((t) => findActiveClip(timeline.clips, t.id, playheadSeconds))
      .filter((c): c is TimelineClip => Boolean(c));
  }, [timeline, sortedTracks, playheadSeconds]);

  const activeCaptionClip = useMemo(() => {
    if (!timeline) return undefined;
    const captionsTrack = sortedTracks.find((t) => isCaptionsTrack(t.type));
    return captionsTrack ? findActiveClip(timeline.clips, captionsTrack.id, playheadSeconds) : undefined;
  }, [timeline, sortedTracks, playheadSeconds]);

  const activeBlurClips = useMemo(() => {
    if (!timeline) return [];
    return sortedTracks
      .filter((t) => isBlurTrack(t.type))
      .map((t) => findActiveClip(timeline.clips, t.id, playheadSeconds))
      .filter((c): c is TimelineClip => Boolean(c && c.blurRegion));
  }, [timeline, sortedTracks, playheadSeconds]);

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-cream">Timeline Editor</h1>
            <p className="text-sm text-silver">Assemble {currentManifest.title} from imported assets and overlays.</p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedTimelineId ?? ""}
              onChange={(e) => setSelectedTimelineId(e.target.value || null)}
              className="rounded-md border border-white/10 bg-charcoal px-2 py-1.5 text-sm text-cream"
            >
              <option value="">Select a timeline...</option>
              {timelines.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleAddTimeline} className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-cream hover:bg-white/5">
              + New Timeline
            </button>
            <button type="button" onClick={handleLoadStandardOverlays} className="rounded-md border border-bronze/40 px-3 py-1.5 text-sm text-bronze hover:bg-bronze/10">
              Load Standard Overlays
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}
        {renderNotice && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {renderNotice}
          </div>
        )}

        {!timeline ? (
          <p className="text-sm text-silver">Select or create a timeline to begin.</p>
        ) : (
          <>
            {/* Preview stage */}
            <div className="mb-4 flex gap-4">
              <div className="relative flex aspect-video w-96 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
                {activeVideoAsset ? (
                  <video ref={videoRef} src={toFileUrl(currentProjectDir, activeVideoAsset.filePath)} className="h-full w-full object-contain" muted={false} />
                ) : (
                  <span className="text-xs text-silver/50">No primary video at playhead</span>
                )}
                {activeOverlayClips.map((clip) => {
                  const template = currentManifest.overlayTemplates.find((o) => o.id === clip.overlayTemplateId);
                  if (!template) return null;
                  const opacity = clipOpacity(clip, playheadSeconds);
                  return (
                    <div
                      key={clip.id}
                      className={`pointer-events-none absolute flex max-w-[80%] flex-col rounded px-3 py-1.5 text-sm font-medium transition-opacity duration-300 ${POSITION_STYLES[template.position]}`}
                      style={{ backgroundColor: template.backgroundColor, color: template.fontColor, opacity }}
                    >
                      {clip.overlayText || template.defaultText}
                    </div>
                  );
                })}
                {activeCaptionClip && (
                  <div className="pointer-events-none absolute bottom-2 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-center text-sm text-white">
                    {activeCaptionClip.overlayText}
                  </div>
                )}
                {activeBlurClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="pointer-events-none absolute border-2 border-dashed border-red-400 bg-black/40 backdrop-blur-[2px]"
                    style={{
                      left: `${clip.blurRegion!.xPercent}%`,
                      top: `${clip.blurRegion!.yPercent}%`,
                      width: `${clip.blurRegion!.widthPercent}%`,
                      height: `${clip.blurRegion!.heightPercent}%`,
                    }}
                    title="Blur region (approximate preview)"
                  />
                ))}
                {audioTracks.map((track) => {
                  const activeClip = findActiveClip(timeline.clips, track.id, playheadSeconds);
                  const asset = activeClip ? currentManifest.assets.find((a) => a.id === activeClip.assetId) : undefined;
                  if (!asset) return null;
                  return (
                    <audio
                      key={track.id}
                      ref={(el) => {
                        if (el) audioRefs.current.set(track.id, el);
                        else audioRefs.current.delete(track.id);
                      }}
                      src={toFileUrl(currentProjectDir, asset.filePath)}
                    />
                  );
                })}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <span className="font-mono text-sm text-cream">{formatTimecode(playheadSeconds)}</span>
                  <span className="text-xs text-silver">/ {formatTimecode(totalDuration)}</span>
                  <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} className="rounded-md border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-30">
                    Undo
                  </button>
                  <button type="button" onClick={handleRedo} disabled={redoStack.length === 0} className="rounded-md border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5 disabled:opacity-30">
                    Redo
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPixelsPerSecondIndex((i) => Math.max(0, i - 1))} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
                    Zoom −
                  </button>
                  <button type="button" onClick={() => setPixelsPerSecondIndex((i) => Math.min(PIXELS_PER_SECOND_STEPS.length - 1, i + 1))} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
                    Zoom +
                  </button>
                  <button type="button" onClick={handleAddMarker} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
                    + Marker at Playhead
                  </button>
                  <button
                    type="button"
                    onClick={handleRenderPreview}
                    disabled={rendering}
                    className="ml-auto rounded-md bg-bronze px-3 py-1.5 text-xs font-medium text-navy disabled:opacity-50"
                  >
                    {rendering ? "Rendering..." : "Quick Preview Render (primary video)"}
                  </button>
                </div>
                <AddTrackControl onAdd={handleAddTrack} />
              </div>
            </div>

            {/* Ruler */}
            <div
              className="relative mb-1 h-6 cursor-pointer border-b border-white/10"
              style={{ width: totalDuration * pixelsPerSecond }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setPlayheadSeconds(Math.max(0, (e.clientX - rect.left) / pixelsPerSecond));
              }}
            >
              {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, i) => i * 5).map((t) => (
                <span key={t} className="absolute top-0 text-[10px] text-silver" style={{ left: t * pixelsPerSecond }}>
                  {formatTimecode(t)}
                </span>
              ))}
              {timeline.markers.map((m) => (
                <div key={m.id} className="absolute top-0 h-full w-px bg-bronze" style={{ left: m.timeSeconds * pixelsPerSecond }} title={m.label} />
              ))}
              <div className="absolute top-0 h-full w-0.5 bg-electric-blue" style={{ left: playheadSeconds * pixelsPerSecond }} />
            </div>

            {/* Tracks */}
            <div className="overflow-x-auto">
              <div style={{ width: Math.max(600, totalDuration * pixelsPerSecond + 200) }}>
                {sortedTracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    clips={timeline.clips.filter((c) => c.trackId === track.id)}
                    assets={currentManifest.assets}
                    overlayTemplates={currentManifest.overlayTemplates}
                    pixelsPerSecond={pixelsPerSecond}
                    selectedClipId={selectedClipId}
                    onSelectClip={setSelectedClipId}
                    onUpdateTrack={(patch) => updateTrack(track.id, patch)}
                    onRemoveTrack={() => removeTrack(track.id)}
                    onAddClip={(refId, kind, duration) => addClipToTrack(track, refId, kind, duration)}
                    onAddBlurClip={() => addBlurClipToTrack(track)}
                  />
                ))}
                {sortedTracks.length === 0 && <p className="text-sm text-silver">No tracks yet. Add one above.</p>}
              </div>
            </div>

            {selectedClip && (
              <ClipInspector
                clip={selectedClip}
                onChange={(patch) => updateClip(selectedClip.id, patch)}
                onRemove={() => removeClip(selectedClip.id)}
                onDuplicate={() => duplicateClip(selectedClip)}
                onSplit={() => splitClipAtPlayhead(selectedClip)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AddTrackControl({ onAdd }: { onAdd: (type: TimelineTrackType) => void }): JSX.Element {
  const [type, setType] = useState<TimelineTrackType>("secondary-video");
  return (
    <div className="flex items-center gap-2">
      <select value={type} onChange={(e) => setType(e.target.value as TimelineTrackType)} className="rounded border border-white/10 bg-charcoal px-2 py-1 text-xs text-cream">
        {TRACK_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.replace(/-/g, " ")}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onAdd(type)} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
        + Add Track
      </button>
    </div>
  );
}

function TrackRow({
  track,
  clips,
  assets,
  overlayTemplates,
  pixelsPerSecond,
  selectedClipId,
  onSelectClip,
  onUpdateTrack,
  onRemoveTrack,
  onAddClip,
  onAddBlurClip,
}: {
  track: TimelineTrack;
  clips: TimelineClip[];
  assets: ProjectManifest["assets"];
  overlayTemplates: ProjectManifest["overlayTemplates"];
  pixelsPerSecond: number;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onUpdateTrack: (patch: Partial<TimelineTrack>) => void;
  onRemoveTrack: () => void;
  onAddClip: (refId: string, kind: "asset" | "overlay", durationSeconds: number) => void;
  onAddBlurClip: () => void;
}): JSX.Element {
  const kind = trackAssetKind(track.type);
  const isBlur = isBlurTrack(track.type);
  const compatibleAssets = assets.filter((a) => assetMatchesTrack(a.originalFileName, track.type));

  return (
    <div className="mb-2 flex border-b border-white/5">
      <div className="w-56 flex-shrink-0 border-r border-white/10 pr-2">
        <div className="flex items-center justify-between">
          <input
            value={track.name}
            onChange={(e) => onUpdateTrack({ name: e.target.value })}
            className="w-28 bg-transparent text-xs font-medium text-cream focus-visible:outline-none"
          />
          <button type="button" onClick={onRemoveTrack} className="text-xs text-red-300 hover:text-red-100">
            ×
          </button>
        </div>
        <p className="mb-1 text-[10px] text-silver/60">{track.type.replace(/-/g, " ")}</p>
        <div className="mb-1 flex gap-1">
          <button type="button" onClick={() => onUpdateTrack({ muted: !track.muted })} className={`rounded px-1.5 py-0.5 text-[10px] ${track.muted ? "bg-red-500/30 text-red-200" : "border border-white/15 text-silver"}`}>
            Mute
          </button>
          <button type="button" onClick={() => onUpdateTrack({ solo: !track.solo })} className={`rounded px-1.5 py-0.5 text-[10px] ${track.solo ? "bg-electric-blue/30 text-electric-blue" : "border border-white/15 text-silver"}`}>
            Solo
          </button>
          <button type="button" onClick={() => onUpdateTrack({ locked: !track.locked })} className={`rounded px-1.5 py-0.5 text-[10px] ${track.locked ? "bg-bronze/30 text-bronze" : "border border-white/15 text-silver"}`}>
            Lock
          </button>
        </div>
        {isBlur ? (
          <button type="button" onClick={onAddBlurClip} className="w-full rounded border border-white/20 px-1.5 py-1 text-[10px] text-cream hover:bg-white/5">
            + Add Blur Region
          </button>
        ) : kind === "overlay" ? (
          <OverlayAddControl templates={overlayTemplates} onAdd={onAddClip} />
        ) : (
          <AssetAddControl assets={compatibleAssets} onAdd={onAddClip} />
        )}
      </div>
      <div className="relative h-16 flex-1 bg-charcoal/40" style={{ minWidth: 400 }}>
        {clips.map((clip) => {
          const label = isBlur
            ? "Blur Region"
            : kind === "overlay"
              ? overlayTemplates.find((o) => o.id === clip.overlayTemplateId)?.name ?? "Overlay"
              : assets.find((a) => a.id === clip.assetId)?.originalFileName ?? "Clip";
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelectClip(clip.id)}
              className={`absolute top-1 flex h-14 items-center overflow-hidden rounded border px-2 text-left text-[11px] ${
                clip.id === selectedClipId ? "border-electric-blue bg-electric-blue/20 text-electric-blue" : "border-white/15 bg-white/5 text-cream hover:border-white/40"
              }`}
              style={{ left: clip.timelineStartSeconds * pixelsPerSecond, width: Math.max(20, clip.timelineDurationSeconds * pixelsPerSecond) }}
              title={label}
            >
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssetAddControl({
  assets,
  onAdd,
}: {
  assets: ProjectManifest["assets"];
  onAdd: (refId: string, kind: "asset" | "overlay", durationSeconds: number) => void;
}): JSX.Element {
  const [assetId, setAssetId] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="w-full rounded border border-white/10 bg-navy px-1 py-1 text-[10px] text-cream">
        <option value="">Choose asset...</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.originalFileName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!assetId}
        onClick={() => {
          const asset = assets.find((a) => a.id === assetId);
          if (asset) onAdd(assetId, "asset", asset.durationSeconds ?? 5);
          setAssetId("");
        }}
        className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-cream hover:bg-white/5 disabled:opacity-40"
      >
        + Add Clip
      </button>
    </div>
  );
}

function OverlayAddControl({
  templates,
  onAdd,
}: {
  templates: ProjectManifest["overlayTemplates"];
  onAdd: (refId: string, kind: "asset" | "overlay", durationSeconds: number) => void;
}): JSX.Element {
  const [templateId, setTemplateId] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded border border-white/10 bg-navy px-1 py-1 text-[10px] text-cream">
        <option value="">Choose overlay...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!templateId}
        onClick={() => {
          const template = templates.find((t) => t.id === templateId);
          if (template) onAdd(templateId, "overlay", template.suggestedDurationSeconds);
          setTemplateId("");
        }}
        className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-cream hover:bg-white/5 disabled:opacity-40"
      >
        + Add Overlay
      </button>
    </div>
  );
}

function ClipInspector({
  clip,
  onChange,
  onRemove,
  onDuplicate,
  onSplit,
}: {
  clip: TimelineClip;
  onChange: (patch: Partial<TimelineClip>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
}): JSX.Element {
  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-charcoal p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium text-cream">Clip Inspector</p>
        <div className="flex gap-2">
          <button type="button" onClick={onSplit} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
            Split at Playhead
          </button>
          <button type="button" onClick={onDuplicate} className="rounded border border-white/20 px-2 py-1 text-xs text-cream hover:bg-white/5">
            Duplicate
          </button>
          <button type="button" onClick={onRemove} className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10">
            Delete
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-silver md:grid-cols-6">
        <label>
          Start (s)
          <input type="number" value={clip.timelineStartSeconds} onChange={(e) => onChange({ timelineStartSeconds: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
        <label>
          Duration (s)
          <input type="number" value={clip.timelineDurationSeconds} onChange={(e) => onChange({ timelineDurationSeconds: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
        <label>
          Source In (s)
          <input type="number" value={clip.sourceInSeconds} onChange={(e) => onChange({ sourceInSeconds: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
        <label>
          Volume
          <input type="number" step="0.1" min="0" max="2" value={clip.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
        <label>
          Fade In (s)
          <input type="number" min="0" value={clip.fadeInSeconds} onChange={(e) => onChange({ fadeInSeconds: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
        <label>
          Fade Out (s)
          <input type="number" min="0" value={clip.fadeOutSeconds} onChange={(e) => onChange({ fadeOutSeconds: Number(e.target.value) })} className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream" />
        </label>
      </div>
      {clip.overlayTemplateId && (
        <div className="mt-3">
          <label className="text-xs text-silver">Overlay Text Override</label>
          <input
            value={clip.overlayText ?? ""}
            onChange={(e) => onChange({ overlayText: e.target.value })}
            placeholder="(uses template default text)"
            className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-sm text-cream"
          />
        </div>
      )}
      {clip.blurRegion && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-silver">
            Blur Region (percent of frame) -- sensitive content in this rectangle is redacted for this clip's time range.
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-silver md:grid-cols-5">
            <label>
              X %
              <input
                type="number"
                min={0}
                max={100}
                value={clip.blurRegion.xPercent}
                onChange={(e) => onChange({ blurRegion: { ...clip.blurRegion!, xPercent: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream"
              />
            </label>
            <label>
              Y %
              <input
                type="number"
                min={0}
                max={100}
                value={clip.blurRegion.yPercent}
                onChange={(e) => onChange({ blurRegion: { ...clip.blurRegion!, yPercent: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream"
              />
            </label>
            <label>
              Width %
              <input
                type="number"
                min={0}
                max={100}
                value={clip.blurRegion.widthPercent}
                onChange={(e) => onChange({ blurRegion: { ...clip.blurRegion!, widthPercent: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream"
              />
            </label>
            <label>
              Height %
              <input
                type="number"
                min={0}
                max={100}
                value={clip.blurRegion.heightPercent}
                onChange={(e) => onChange({ blurRegion: { ...clip.blurRegion!, heightPercent: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream"
              />
            </label>
            <label>
              Strength
              <input
                type="number"
                min={1}
                max={50}
                value={clip.blurRegion.blurStrength}
                onChange={(e) => onChange({ blurRegion: { ...clip.blurRegion!, blurStrength: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-white/10 bg-navy px-2 py-1 text-cream"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
