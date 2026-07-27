import type { Prompt } from "@aether/shared-types";

/** Assembles a plain-text prompt string from structured fields for copy/export. */
export function assemblePromptText(prompt: Prompt): string {
  const parts: Array<string | undefined> = [
    prompt.subject,
    prompt.action,
    prompt.environment && `in ${prompt.environment}`,
    prompt.composition && `composition: ${prompt.composition}`,
    prompt.camera && `camera: ${prompt.camera}`,
    prompt.lens && `lens: ${prompt.lens}`,
    prompt.lighting && `lighting: ${prompt.lighting}`,
    prompt.mood && `mood: ${prompt.mood}`,
    prompt.visualStyle && `style: ${prompt.visualStyle}`,
    prompt.movement && `movement: ${prompt.movement}`,
    prompt.continuityRequirements && `continuity: ${prompt.continuityRequirements}`,
  ];
  const body = parts.filter(Boolean).join(", ");
  const negative = prompt.negativePrompt ? `\nNegative prompt: ${prompt.negativePrompt}` : "";
  return `${body}${negative}`;
}
