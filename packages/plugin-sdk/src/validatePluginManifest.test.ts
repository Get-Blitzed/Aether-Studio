import { describe, expect, it } from "vitest";
import { validatePluginManifest } from "./validatePluginManifest.js";

describe("validatePluginManifest", () => {
  it("accepts a well-formed manifest", () => {
    const result = validatePluginManifest({
      id: "example-plugin",
      name: "Example Plugin",
      version: "1.0.0",
      capabilities: ["text-provider"],
      entryPoint: "index.js",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a manifest with no capabilities", () => {
    const result = validatePluginManifest({
      id: "example-plugin",
      name: "Example Plugin",
      version: "1.0.0",
      capabilities: [],
      entryPoint: "index.js",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-semver version", () => {
    const result = validatePluginManifest({
      id: "example-plugin",
      name: "Example Plugin",
      version: "v1",
      capabilities: ["text-provider"],
      entryPoint: "index.js",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes("version"))).toBe(true);
  });

  it("rejects an unknown capability", () => {
    const result = validatePluginManifest({
      id: "example-plugin",
      name: "Example Plugin",
      version: "1.0.0",
      capabilities: ["not-a-real-capability"],
      entryPoint: "index.js",
    });
    expect(result.ok).toBe(false);
  });
});
