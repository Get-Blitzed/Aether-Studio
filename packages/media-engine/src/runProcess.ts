import { execFile } from "node:child_process";

export interface RunResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs a binary with an argument array via execFile (never a shell string),
 * so arguments can never be reinterpreted as shell syntax regardless of
 * their content -- this is the injection-safety guarantee, not just a
 * style preference.
 */
export function runProcess(binaryPath: string, args: string[], timeoutMs = 30_000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      binaryPath,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 32 },
      (error, stdout, stderr) => {
        if (error) {
          reject(Object.assign(error, { stdout, stderr }));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}
