/**
 * The mock provider doesn't run a real language model, so it can't parse
 * free-form natural language reliably. Instead, the app builds prompts in
 * this lightweight `KEY: value` structured format for tasks it wants a
 * deterministic mock response for -- the same prompt string is also what
 * gets sent to a real provider (OpenAI-compatible/generic REST), which
 * handles plain structured text as a prompt just fine. This keeps one
 * prompt-building path for both mock and real providers.
 */
export interface ParsedTask {
  task: string;
  fields: Record<string, string>;
}

export function buildStructuredPrompt(task: string, fields: Record<string, string | number | undefined>): string {
  const lines = [`TASK: ${task}`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`${key.toUpperCase()}: ${value}`);
  }
  return lines.join("\n");
}

export function parseStructuredPrompt(prompt: string): ParsedTask {
  const fields: Record<string, string> = {};
  let task = "generic";
  for (const rawLine of prompt.split("\n")) {
    const line = rawLine.trim();
    const match = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2] ?? "";
    if (key === "task") task = value.trim().toLowerCase();
    else fields[key] = value;
  }
  return { task, fields };
}
