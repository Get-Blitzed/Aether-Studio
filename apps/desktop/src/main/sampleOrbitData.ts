import { generateId, nowIso } from "@aether/core";
import {
  CharacterSchema,
  BrandSchema,
  ScriptSchema,
  type Character,
  type Brand,
  type Script,
} from "@aether/shared-types";

export function buildNovaCharacter(): Character {
  const timestamp = nowIso();
  return CharacterSchema.parse({
    id: generateId("char"),
    name: "Nova",
    role: "Orbit Onboarding Guide",
    characterType: "Non-humanoid comet-being of light",
    personality: "Curious, warm, encouraging, a little playful, never condescending",
    speakingStyle: "Friendly, plain-spoken, upbeat without being hyper; short sentences",
    visualDescription:
      "A small glowing sphere of shifting aurora-gradient light (pink-violet-cyan) with a soft comet trail that lengthens when excited and settles when calm; two simple dot eyes and a curved-line mouth are the only facial features. No limbs -- gestures are conveyed through orbiting sparks and trail motion.",
    wardrobe: [],
    colors: ["Aurora pink", "Violet", "Aurora cyan", "Warm amber accent"],
    materials: ["Soft volumetric glow", "Particle trail", "Orbiting spark accents"],
    props: ["Small orbiting light-motes that appear when demonstrating a feature"],
    signatureGestures: ["Extends a thin trail toward whatever it's pointing out on screen"],
    signaturePoses: ["Pulses brighter for a beat before revealing something new"],
    allowedEmotions: ["curious", "warm", "encouraging", "playfully excited"],
    prohibitedBehaviors: ["Frantic or jittery motion", "Harsh flashing", "Condescending tone"],
    cameraRules: ["Keep Nova small relative to the workspace it's introducing", "Gentle, floaty motion, never rigid"],
    lightingRules: ["Core glow brightens on emphasis, dims to a calm pulse when listening/waiting"],
    animationRestrictions: [
      "Smooth easing on all motion -- no linear/mechanical movement",
      "Trail length scales with emotional intensity",
      "No mouth shapes beyond a simple curve (no visible lip sync needed)",
    ],
    requiresLipSync: false,
    references: [],
    locks: {
      referenceLock: true,
      costumeLock: false,
      colorLock: true,
      silhouetteLock: true,
      maskLock: false,
      hairstyleLock: false,
      accessoryLock: true,
    },
    versionHistory: [{ version: 1, savedAt: timestamp, note: "Sample profile seeded from template" }],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

export function buildOrbitBrand(): Brand {
  const timestamp = nowIso();
  return BrandSchema.parse({
    id: generateId("brand"),
    name: "Orbit",
    companyOrProductName: "Orbit",
    logoVariants: [],
    colorPalette: [
      { name: "Deep Navy", hex: "#131A2B" },
      { name: "Charcoal", hex: "#1B1F27" },
      { name: "Aurora Pink", hex: "#FF3EA5" },
      { name: "Electric Violet", hex: "#7C5CFC" },
      { name: "Aurora Cyan", hex: "#22D3EE" },
      { name: "Bronze/Amber", hex: "#FFB020" },
    ],
    voiceAndTone: "Warm, encouraging, plain-spoken -- confident without hype.",
    approvedTerminology: ["Orbit", "Workspace", "Team", "Flow"],
    prohibitedTerminology: ["revolutionary", "game-changing", "disrupt"],
    productCapitalizationRules: ['Always write "Orbit" with a capital O, never "ORBIT" or "orbit"'],
    disclaimers: ["CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION"],
    accessibilityRequirements: ["Captions required on all narration", "Minimum 4.5:1 text contrast"],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

/** Mission 001 sample script for the Orbit onboarding series, narrated by Nova. */
export function buildMission001Script(): Script {
  const timestamp = nowIso();
  return ScriptSchema.parse({
    id: generateId("script"),
    title: "Orbit -- Mission 001: Welcome to Orbit",
    targetDurationSeconds: 420,
    narrationSpeedWpm: 130,
    revision: 1,
    createdAt: timestamp,
    modifiedAt: timestamp,
    segments: [
      {
        id: generateId("seg"),
        sceneNumber: 1,
        sceneTitle: "Cold Open",
        estimatedDurationSeconds: 20,
        onScreenAction:
          "A cluttered workspace of scattered chat windows, spreadsheets, and sticky notes fills the screen. Everything dims. A small point of light drifts in.",
        narration: "“Scattered isn’t the same as organized.” (pause) “Let’s fix that.”",
        overlayText: "WELCOME TO ORBIT",
        approvalStatus: "draft",
        notes: "Cold open -- establishes tone before Nova is introduced.",
      },
      {
        id: generateId("seg"),
        sceneNumber: 2,
        sceneTitle: "Meet Your Guide",
        estimatedDurationSeconds: 30,
        onScreenAction: "Nova drifts into frame above a calm, softly lit workspace.",
        narration: "“Hi, I’m Nova. I’ll guide you through Orbit, one mission at a time.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 3,
        sceneTitle: "The Problem",
        estimatedDurationSeconds: 45,
        onScreenAction:
          "A user bounces between disconnected chat threads, documents, and task boards, losing track of what's actually next.",
        narration:
          "“Most teams don’t lose time doing the work -- they lose it hunting for the work. Conversations live in one place, files in another, and nobody's sure what's actually next.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 4,
        sceneTitle: "The Orbit Vision",
        estimatedDurationSeconds: 60,
        onScreenAction: "Scattered chat bubbles, files, and tasks drift together into one orderly workspace.",
        narration:
          "“Orbit is designed to bring your team's conversations, files, and tasks into one shared space that stays in sync automatically.”",
        unverifiedClaim: true,
        notes: "CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 5,
        sceneTitle: "What Users Can Expect",
        estimatedDurationSeconds: 60,
        onScreenAction: "Concept cards for planning, sharing, assigning, tracking, and celebrating finished work.",
        narration:
          "“In this series, you’ll learn how to set up your first workspace, invite your team, organize shared files, assign and track tasks, and keep everyone moving in the same direction.”",
        unverifiedClaim: true,
        notes: "Claims editable until confirmed through approved product documentation.",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 6,
        sceneTitle: "How the Training Works",
        estimatedDurationSeconds: 45,
        onScreenAction: "A mission map displays future episodes.",
        narration:
          "“Each lesson is one focused mission. You’ll see what a feature does, why it matters, how to use it, and the mistakes worth avoiding.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 7,
        sceneTitle: "Nova Tip",
        estimatedDurationSeconds: 30,
        overlayText: "NOVA TIP",
        narration:
          "“Start with just one team channel you actually use every day. A small workspace that works beats a big one nobody opens.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 8,
        sceneTitle: "Next Mission Preview",
        estimatedDurationSeconds: 45,
        narration: "“In the next mission, we’ll set up your first Orbit workspace and invite your team.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 9,
        sceneTitle: "Closing",
        estimatedDurationSeconds: 20,
        onScreenAction: "Nova brightens beside the Orbit mark.",
        narration: "“Your workspace is waiting. Let’s bring your team into orbit.”",
        overlayText: "NEXT MISSION: Setting Up Your First Workspace",
        approvalStatus: "draft",
      },
    ],
  });
}
