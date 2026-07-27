import { locateFfmpeg } from "./ffmpegLocator.js";
import { runProcess } from "./runProcess.js";

export interface FfmpegStatus {
  ffmpegFound: boolean;
  ffmpegPath: string | null;
  ffprobeFound: boolean;
  ffprobePath: string | null;
  version: string | null;
}

/** Used by Settings' "Test FFmpeg" action -- actually invokes the binary rather than just checking the path exists. */
export async function checkFfmpegStatus(overridePath?: string): Promise<FfmpegStatus> {
  const { ffmpegPath, ffprobePath } = locateFfmpeg(overridePath);
  let version: string | null = null;

  if (ffmpegPath) {
    try {
      const { stdout } = await runProcess(ffmpegPath, ["-version"], 10_000);
      version = stdout.split("\n")[0] ?? null;
    } catch {
      version = null;
    }
  }

  return {
    ffmpegFound: ffmpegPath !== null && version !== null,
    ffmpegPath,
    ffprobeFound: ffprobePath !== null,
    ffprobePath,
    version,
  };
}
