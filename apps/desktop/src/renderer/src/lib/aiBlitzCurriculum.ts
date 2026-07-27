import type { SeriesPlan } from "@aether/shared-types";
import { generateId, nowIso } from "./ids";

const MISSION_TITLES = [
  "Welcome to A.I. Blitz",
  "Creating Your First Workspace",
  "Building Your First AI Agent",
  "Connecting Tools and Services",
  "Creating an Automated Workflow",
  "Working with AI Teams",
  "Managing Knowledge and Files",
  "Testing and Improving Outputs",
  "Publishing and Sharing",
  "Advanced A.I. Blitz Operations",
];

/** Sample editable curriculum -- not a hard-coded limitation of the app. */
export function buildAiBlitzSampleCurriculum(): SeriesPlan {
  const timestamp = nowIso();
  const episodes = MISSION_TITLES.map((title, index) => ({
    id: generateId("episode"),
    order: index + 1,
    title: `Mission ${String(index + 1).padStart(3, "0")} - ${title}`,
    objective: `Introduce learners to: ${title.toLowerCase()}.`,
    learningOutcomes: [] as string[],
    prerequisites: index === 0 ? [] : [`Mission ${String(index).padStart(3, "0")}`],
    targetAudience: "New A.I. Blitz users",
    difficulty: (index < 3 ? "beginner" : index < 7 ? "intermediate" : "advanced") as
      | "beginner"
      | "intermediate"
      | "advanced",
    targetDurationSeconds: 420,
    requiredDemonstrations: [] as string[],
    dependsOnEpisodeIds: [] as string[],
    callToAction: index < MISSION_TITLES.length - 1 ? "Continue to the next mission." : "Explore advanced operations.",
    nextEpisodeTeaser: index < MISSION_TITLES.length - 1 ? MISSION_TITLES[index + 1] : undefined,
    status: index === 0 ? ("ready" as const) : ("idea" as const),
    notes: "Sample record -- fully editable.",
  }));

  return {
    id: generateId("series"),
    title: "A.I. Blitz Missions",
    seasonTitle: "Season 1",
    recurringIntro: "Blitz activates a holographic interface and greets the learner.",
    recurringOutro: "Blitz previews the next mission and signs off.",
    recurringSegments: ["Blitz Tip", "Mission Objective", "System Check"],
    episodes,
    notes: "Sample curriculum for the A.I. Blitz training series. Fully editable.",
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}
