/** Builds a file:// URL from an absolute Windows/Unix path plus a relative sub-path. */
export function toFileUrl(baseDir: string, relativePath: string): string {
  const combined = `${baseDir.replace(/\\/g, "/")}/${relativePath.replace(/\\/g, "/")}`;
  const normalized = combined.replace(/^\/?/, "/");
  return `file://${encodeURI(normalized)}`;
}
