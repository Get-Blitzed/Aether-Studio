import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../components/NavSidebar";
import { NoProjectOpen } from "../components/NoProjectOpen";
import { ErrorBanner } from "../components/ErrorBanner";
import { useAppStore } from "../state/appStore";

export function DocumentImport(): JSX.Element {
  const currentManifest = useAppStore((s) => s.currentManifest);
  const currentProjectDir = useAppStore((s) => s.currentProjectDir);
  const setCurrentProject = useAppStore((s) => s.setCurrentProject);
  const navigate = useNavigate();

  const [chosenFile, setChosenFile] = useState<string | null>(null);
  const [narrate, setNarrate] = useState(true);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [result, setResult] = useState<
    | { mode: "asset-import" }
    | { mode: "document-conversion"; timelineId: string; pageCount: number; narratedPageCount: number }
    | null
  >(null);

  if (!currentManifest || !currentProjectDir) return <NoProjectOpen what="document import" />;

  async function handleChooseFile() {
    const filePath = await window.aether.documents.chooseFile();
    if (filePath) {
      setChosenFile(filePath);
      setResult(null);
      setError(null);
    }
  }

  async function handleConvert() {
    if (!chosenFile) return;
    setConverting(true);
    setError(null);
    setResult(null);
    const res = await window.aether.documents.importAndConvert({
      projectDir: currentProjectDir!,
      filePath: chosenFile,
      narrate,
    });
    setConverting(false);
    if (res.ok) {
      setCurrentProject(currentProjectDir!, res.manifest);
      if (res.mode === "document-conversion") {
        setResult({
          mode: "document-conversion",
          timelineId: res.timelineId,
          pageCount: res.pageCount,
          narratedPageCount: res.narratedPageCount,
        });
      } else {
        setResult({ mode: "asset-import" });
      }
      setChosenFile(null);
    } else {
      setError(res.error ?? { title: "Import failed", detail: "Unknown error" });
    }
  }

  const fileName = chosenFile ? chosenFile.split(/[\\/]/).pop() : null;
  const isDocument = fileName ? /\.(pdf|docx|pptx)$/i.test(fileName) : false;

  return (
    <div className="flex h-screen bg-navy">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-cream">Document Import</h1>
          <p className="text-sm text-silver">
            Turn a PDF, Word document, or slide deck into a narrated video project -- or drop in an existing video/audio
            file to add it straight to the Asset Library.
          </p>
        </header>

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {result && (
          <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {result.mode === "document-conversion" ? (
              <>
                Converted {result.pageCount} page{result.pageCount === 1 ? "" : "s"} into a script, storyboard, and
                timeline
                {result.narratedPageCount > 0
                  ? `, with native-voice narration on ${result.narratedPageCount} of ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}`
                  : ""}
                .{" "}
                <button type="button" onClick={() => navigate("/timeline")} className="underline hover:text-emerald-100">
                  Open in Timeline Editor
                </button>
              </>
            ) : (
              "File added to the Asset Library."
            )}
          </div>
        )}

        <div className="max-w-xl rounded-lg border border-white/10 bg-charcoal p-6">
          <p className="mb-3 text-sm text-silver">
            Supported: PDF, DOCX, PPTX (auto-generates narration script + storyboard + timeline) and MP4, MKV, MOV,
            WEBM, AVI (imported directly as a video asset).
          </p>

          <button
            type="button"
            onClick={handleChooseFile}
            className="rounded-md border border-white/20 px-4 py-2 text-sm text-cream hover:bg-white/5"
          >
            Choose File...
          </button>

          {fileName && (
            <div className="mt-4 rounded-md border border-white/10 bg-navy px-4 py-3">
              <p className="break-all text-sm text-cream">{fileName}</p>
              <p className="mt-1 text-xs text-silver">
                {isDocument
                  ? "Will be extracted page-by-page and converted into a full video project."
                  : "Will be added directly to the Asset Library."}
              </p>
              {isDocument && (
                <label className="mt-3 flex items-center gap-2 text-xs text-silver">
                  <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} />
                  Generate native-voice narration automatically (Windows SAPI, offline)
                </label>
              )}
              <button
                type="button"
                onClick={handleConvert}
                disabled={converting}
                className="mt-3 rounded-md bg-electric-blue px-4 py-2 text-sm font-medium text-navy disabled:opacity-50"
              >
                {converting ? "Converting..." : isDocument ? "Convert to Video Project" : "Add to Asset Library"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
