import { generateId, nowIso } from "@aether/core";
import {
  CharacterSchema,
  BrandSchema,
  ScriptSchema,
  type Character,
  type Brand,
  type Script,
} from "@aether/shared-types";

export function buildBlitzCharacter(): Character {
  const timestamp = nowIso();
  return CharacterSchema.parse({
    id: generateId("char"),
    name: "Blitz",
    role: "Chief AI Guide",
    characterType: "Masked futuristic technology guide",
    personality: "Calm, capable, helpful, confident, lightly humorous",
    speakingStyle: "Clear, concise, encouraging, professional, and never arrogant",
    visualDescription:
      "Dark curly hair; angular black full-face mask; illuminated blue eyes; black futuristic armored clothing; long black coat with gold trim; glowing electric-blue accents; black gloves; dark armored boots. Premium cinematic technology aesthetic.",
    wardrobe: ["Long black coat", "Black armored bodysuit", "Black gloves", "Dark armored boots"],
    colors: ["Black", "Gold trim", "Electric blue glow"],
    materials: ["Matte armor plating", "Illuminated mask visor", "Woven coat fabric"],
    props: ["Holographic interface"],
    signatureGestures: ["Raises one hand and activates a holographic interface"],
    signaturePoses: ["Points toward the viewer during an important announcement"],
    allowedEmotions: ["calm", "confident", "encouraging", "lightly humorous"],
    prohibitedBehaviors: [
      "Exaggerated superhero poses during training scenes",
      "Aggressive or threatening gestures",
    ],
    cameraRules: ["Maintain a calm, authoritative presence", "Avoid rapid handheld motion"],
    lightingRules: ["Eye illumination may brighten for emphasis on key lines"],
    animationRestrictions: [
      "Restrained professional movement",
      "Subtle breathing",
      "Natural coat motion",
      "Controlled hand gestures",
      "Limited head tilts",
      "No visible lip synchronization required (masked character)",
    ],
    requiresLipSync: false,
    references: [],
    locks: {
      referenceLock: true,
      costumeLock: true,
      colorLock: true,
      silhouetteLock: true,
      maskLock: true,
      hairstyleLock: true,
      accessoryLock: true,
    },
    versionHistory: [{ version: 1, savedAt: timestamp, note: "Sample profile seeded from template" }],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

export function buildAiBlitzBrand(): Brand {
  const timestamp = nowIso();
  return BrandSchema.parse({
    id: generateId("brand"),
    name: "A.I. Blitz",
    companyOrProductName: "A.I. Blitz",
    logoVariants: [],
    colorPalette: [
      { name: "Charcoal", hex: "#1B1F27" },
      { name: "Deep Navy", hex: "#131A2B" },
      { name: "Bronze", hex: "#B08D57" },
      { name: "Electric Blue", hex: "#3E8EF7" },
      { name: "Cream", hex: "#F4EFE6" },
    ],
    voiceAndTone: "Calm, capable, encouraging, precise -- never hype-driven.",
    approvedTerminology: ["A.I. Blitz", "Mission", "Workspace"],
    prohibitedTerminology: ["revolutionary", "game-changing", "disrupt"],
    productCapitalizationRules: ['Always write "A.I. Blitz" with periods and capital letters'],
    disclaimers: ["CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION"],
    accessibilityRequirements: ["Captions required on all narration", "Minimum 4.5:1 text contrast"],
    createdAt: timestamp,
    modifiedAt: timestamp,
  });
}

/** Mission 001 sample script, transcribed from the approved sample structure. */
export function buildMission001Script(): Script {
  const timestamp = nowIso();
  return ScriptSchema.parse({
    id: generateId("script"),
    title: "A.I. Blitz -- Mission 001: Welcome to A.I. Blitz",
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
          "A chaotic digital workspace fills the screen with notifications, browser tabs, messages, documents, and unfinished tasks. Everything freezes. Blitz enters.",
        narration: "“Busy is not the same as productive.” (pause) “Let’s fix that.”",
        overlayText: "WELCOME TO A.I. BLITZ",
        approvalStatus: "draft",
        notes: "Cold open -- establishes tone before Blitz is introduced.",
      },
      {
        id: generateId("seg"),
        sceneNumber: 2,
        sceneTitle: "Meet Your Guide",
        estimatedDurationSeconds: 30,
        onScreenAction: "Blitz stands in a clean digital command center.",
        narration: "“I’m Blitz. I’ll guide you through A.I. Blitz, one mission at a time.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 3,
        sceneTitle: "The Problem",
        estimatedDurationSeconds: 45,
        onScreenAction:
          "A user repeatedly switches between disconnected applications, emails, files, documents, and task lists.",
        narration:
          "“Most work becomes difficult long before the difficult work begins. Information is scattered. Tools are disconnected. Repetitive tasks consume time that should be used for decisions, creativity, and growth.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 4,
        sceneTitle: "The A.I. Blitz Vision",
        estimatedDurationSeconds: 60,
        onScreenAction:
          "Disconnected applications and information become organized around a central workspace.",
        narration:
          "“A.I. Blitz is designed to help bring artificial intelligence, useful tools, organized knowledge, and repeatable workflows into one productive environment.”",
        unverifiedClaim: true,
        notes: "CONFIRM FINAL PRODUCT WORDING BEFORE PUBLICATION",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 5,
        sceneTitle: "What Users Can Expect",
        estimatedDurationSeconds: 60,
        onScreenAction: "Concept cards for planning, creating, connecting, automating, reviewing, and publishing.",
        narration:
          "“In this series, you’ll learn how to set up your workspace, create AI-powered resources, connect approved services, organize information, build repeatable processes, test results, and turn ideas into useful outputs.”",
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
          "“Each lesson is designed as a focused mission. You’ll see what the feature does, why it matters, how to use it, and which mistakes to avoid.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 7,
        sceneTitle: "Blitz Tip",
        estimatedDurationSeconds: 30,
        overlayText: "BLITZ TIP",
        narration:
          "“Start with one problem you understand well. A small workflow that works is more valuable than a complicated system no one trusts.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 8,
        sceneTitle: "Next Mission Preview",
        estimatedDurationSeconds: 45,
        narration:
          "“In the next mission, we’ll create your first workspace and prepare it for your first A.I. Blitz project.”",
        approvalStatus: "draft",
      },
      {
        id: generateId("seg"),
        sceneNumber: 9,
        sceneTitle: "Closing",
        estimatedDurationSeconds: 20,
        onScreenAction: "Blitz activates the A.I. Blitz logo behind him.",
        narration: "“Your tools are ready. Your first objective is waiting. Let’s begin.”",
        overlayText: "NEXT MISSION: Creating Your First Workspace",
        approvalStatus: "draft",
      },
    ],
  });
}
