import { describe, expect, it, afterEach } from "vitest";
import { sanitizeFileName, getAppDataDir, getDefaultProjectsDir, getCacheDir } from "./paths.js";

describe("sanitizeFileName", () => {
  it("replaces filesystem-reserved characters", () => {
    expect(sanitizeFileName('A.I. Blitz: Mission "001"?')).not.toMatch(/[<>:"/\\|?*]/);
  });

  it("guards against Windows reserved device names", () => {
    expect(sanitizeFileName("CON")).not.toBe("CON");
    expect(sanitizeFileName("con")).not.toBe("con");
    expect(sanitizeFileName("NUL")).not.toBe("NUL");
  });

  it("falls back to a default when the input is empty after cleanup", () => {
    expect(sanitizeFileName("   ")).toBe("untitled");
  });

  it("strips trailing dots and spaces (invalid on Windows)", () => {
    const result = sanitizeFileName("My Production...   ");
    expect(result.endsWith(".")).toBe(false);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("leaves an ordinary title unchanged", () => {
    expect(sanitizeFileName("Mission 001")).toBe("Mission 001");
  });
});

describe("appdata paths", () => {
  const originalOverride = process.env.AETHER_APPDATA_OVERRIDE;
  const originalDocsOverride = process.env.AETHER_DOCUMENTS_OVERRIDE;

  afterEach(() => {
    process.env.AETHER_APPDATA_OVERRIDE = originalOverride;
    process.env.AETHER_DOCUMENTS_OVERRIDE = originalDocsOverride;
  });

  it("honors AETHER_APPDATA_OVERRIDE for the app data dir", () => {
    process.env.AETHER_APPDATA_OVERRIDE = "D:\\Fake\\AppData";
    expect(getAppDataDir()).toBe("D:\\Fake\\AppData\\Aether Studio Suite");
  });

  it("honors AETHER_DOCUMENTS_OVERRIDE for the default projects dir", () => {
    process.env.AETHER_DOCUMENTS_OVERRIDE = "D:\\Fake\\Documents";
    expect(getDefaultProjectsDir()).toBe("D:\\Fake\\Documents\\Aether Studio Suite");
  });

  it("nests the cache dir under the app data dir", () => {
    process.env.AETHER_APPDATA_OVERRIDE = "D:\\Fake\\AppData";
    expect(getCacheDir()).toBe("D:\\Fake\\AppData\\Aether Studio Suite\\cache");
  });
});
