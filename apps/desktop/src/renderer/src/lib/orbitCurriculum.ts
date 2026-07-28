import type { SeriesPlan } from "@aether/shared-types";
import { generateId, nowIso } from "./ids";

const MISSION_TITLES = [
  "Welcome to Orbit",
  "Setting Up Your First Workspace",
  "Inviting Your Team",
  "Organizing Shared Files",
  "Creating Your First Task Board",
  "Assigning and Tracking Work",
  "Connecting Everyday Tools",
  "Automating Repetitive Handoffs",
  "Reviewing and Reporting Progress",
  "Advanced Orbit Workflows",
];

/** Sample editable curriculum -- not a hard-coded limitation of the app. */
export function buildOrbitSampleCurriculum(): SeriesPlan {
  const timestamp = nowIso();
  const episodes = MISSION_TITLES.map((title, index) => ({
    id: generateId("episode"),
    order: index + 1,
    title: `Mission ${String(index + 1).padStart(3, "0")} - ${title}`,
    objective: `Introduce learners to: ${title.toLowerCase()}.`,
    learningOutcomes: [] as string[],
    prerequisites: index === 0 ? [] : [`Mission ${String(index).padStart(3, "0")}`],
    targetAudience: "New Orbit users",
    difficulty: (index < 3 ? "beginner" : index < 7 ? "intermediate" : "advanced") as
      | "beginner"
      | "intermediate"
      | "advanced",
    targetDurationSeconds: 420,
    requiredDemonstrations: [] as string[],
    dependsOnEpisodeIds: [] as string[],
    callToAction: index < MISSION_TITLES.length - 1 ? "Continue to the next mission." : "Explore advanced workflows.",
    nextEpisodeTeaser: index < MISSION_TITLES.length - 1 ? MISSION_TITLES[index + 1] : undefined,
    status: index === 0 ? ("ready" as const) : ("idea" as const),
    notes: "Sample record -- fully editable.",
  }));

  return {
    id: generateId("series"),
    title: "Orbit Missions",
    seasonTitle: "Season 1",
    recurringIntro: "Nova drifts into frame and greets the learner with a warm pulse of light.",
    recurringOutro: "Nova previews the next mission and dims to a calm glow.",
    recurringSegments: ["Nova Tip", "Mission Objective", "System Check"],
    episodes,
    notes: "Sample curriculum for the Orbit onboarding series. Fully editable.",
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}
