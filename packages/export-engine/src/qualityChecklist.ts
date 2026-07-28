import type { ProjectManifest, QualityCheck } from "@aether/shared-types";
import { isAudioTrackType } from "@aether/shared-types";

function check(id: string, label: string, status: QualityCheck["status"], detail?: string): QualityCheck {
  return { id, label, status, detail };
}

/**
 * A pure, deterministic Quality-Control checklist run against a project's
 * manifest -- no ffmpeg, no filesystem access, no network. Every check
 * here is computable from data already in memory, which is what makes it
 * fast enough to re-run on every visit to the Export/Review screens and
 * fully unit-testable without fixtures.
 *
 * Checks are informational, not blocking -- a "fail" status is a strong
 * signal something is missing, not a hard gate that prevents exporting.
 */
export function runQualityChecklist(manifest: ProjectManifest): QualityCheck[] {
  const results: QualityCheck[] = [];

  const allSegments = manifest.scripts.flatMap((s) => s.segments);
  const unverifiedCount = allSegments.filter((s) => s.unverifiedClaim).length;
  results.push(
    unverifiedCount === 0
      ? check("unverified-claims", "Unverified claims resolved", "pass")
      : check(
          "unverified-claims",
          "Unverified claims resolved",
          "fail",
          `${unverifiedCount} segment${unverifiedCount === 1 ? "" : "s"} still flagged as an unverified claim.`,
        ),
  );

  if (allSegments.length === 0) {
    results.push(check("scenes-approved", "All scenes approved", "warning", "No script segments exist yet."));
  } else {
    const unapproved = allSegments.filter((s) => s.approvalStatus !== "approved").length;
    results.push(
      unapproved === 0
        ? check("scenes-approved", "All scenes approved", "pass")
        : check("scenes-approved", "All scenes approved", "warning", `${unapproved} scene${unapproved === 1 ? "" : "s"} not yet approved.`),
    );
  }

  if (manifest.storyboardFrames.length === 0) {
    results.push(check("storyboard-approved", "All storyboard frames approved", "warning", "No storyboard frames exist yet."));
  } else {
    const unapproved = manifest.storyboardFrames.filter((f) => f.productionStatus !== "approved").length;
    results.push(
      unapproved === 0
        ? check("storyboard-approved", "All storyboard frames approved", "pass")
        : check(
            "storyboard-approved",
            "All storyboard frames approved",
            "warning",
            `${unapproved} frame${unapproved === 1 ? "" : "s"} not yet approved.`,
          ),
    );
  }

  results.push(
    manifest.timelines.length === 0
      ? check("timeline-exists", "A timeline exists", "fail", "No timeline has been created yet.")
      : check("timeline-exists", "A timeline exists", "pass"),
  );

  if (manifest.timelines.length === 0) {
    results.push(check("primary-video-track", "Primary video track has clips", "fail", "No timeline to check."));
    results.push(check("audio-track-present", "At least one audio track has clips", "warning", "No timeline to check."));
  } else {
    const allClips = manifest.timelines.flatMap((t) => t.clips.map((c) => ({ clip: c, timeline: t })));
    const hasPrimaryVideoClip = manifest.timelines.some((t) => {
      const primaryTrackIds = new Set(t.tracks.filter((tr) => tr.type === "primary-video").map((tr) => tr.id));
      return t.clips.some((c) => primaryTrackIds.has(c.trackId));
    });
    results.push(
      hasPrimaryVideoClip
        ? check("primary-video-track", "Primary video track has clips", "pass")
        : check("primary-video-track", "Primary video track has clips", "fail", "No clips on any Primary Video track."),
    );

    const hasAudioClip = manifest.timelines.some((t) => {
      const audioTrackIds = new Set(t.tracks.filter((tr) => isAudioTrackType(tr.type)).map((tr) => tr.id));
      return t.clips.some((c) => audioTrackIds.has(c.trackId));
    });
    results.push(
      hasAudioClip
        ? check("audio-track-present", "At least one audio track has clips", "pass")
        : check("audio-track-present", "At least one audio track has clips", "warning", "No narration, music, or sound-effect clips found."),
    );

    const assetIds = new Set(manifest.assets.map((a) => a.id));
    const orphanedClips = allClips.filter(({ clip }) => clip.assetId !== undefined && !assetIds.has(clip.assetId));
    results.push(
      orphanedClips.length === 0
        ? check("no-orphaned-clip-assets", "No clips reference a missing asset", "pass")
        : check(
            "no-orphaned-clip-assets",
            "No clips reference a missing asset",
            "fail",
            `${orphanedClips.length} clip${orphanedClips.length === 1 ? "" : "s"} reference an asset no longer in the library.`,
          ),
    );
  }

  results.push(
    manifest.captions.length === 0
      ? check("captions-present", "Captions have been added", "warning", "No captions exist yet -- consider generating them from the script.")
      : check("captions-present", "Captions have been added", "pass"),
  );

  return results;
}
