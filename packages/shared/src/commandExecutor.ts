import { spawn } from "node:child_process";
import { EXECUTION } from "./constants.js";
import { Logger } from "./logger.js";

const IS_WINDOWS = process.platform === "win32";

function getTimeoutMs(): number {
  const envVal = process.env[EXECUTION.TIMEOUT_ENV_VAR];
  if (envVal) {
    const parsed = Number(envVal);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return EXECUTION.DEFAULT_TIMEOUT_MS;
}

export function quoteArgsForWindows(args: string[]): string[] {
  return args.map((a) => {
    if (a.includes(" ") || a.includes('"') || a.includes("&") || a.includes("|") || a.includes("^")) {
      return `"${a.replace(/"/g, '\\"')}"`;
    }
    return a;
  });
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  onStderr?: (stderr: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const commandId = Logger.commandExecution(command, args);

    const safeArgs = IS_WINDOWS ? quoteArgsForWindows(args) : args;

    const childProcess = spawn(command, safeArgs, {
      env: process.env,
      shell: IS_WINDOWS,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Close stdin immediately to signal EOF. Using "pipe" + end() instead of
    // "ignore" (/dev/null) prevents stdin pipe errors in CLIs that probe stdin
    // (e.g., Codex CLI when spawned from agent sub-processes). See issue #19.
    childProcess.stdin.on("error", () => {});
    childProcess.stdin.end();

    const stdoutChunks: Buffer[] = [];
    let stderr = "";
    let isResolved = false;

    const timeoutMs = getTimeoutMs();
    const timer = setTimeout(() => {
      if (isResolved) return;
      Logger.warn(`[cmd:${commandId}] Timeout after ${timeoutMs}ms, sending SIGTERM`);
      childProcess.kill("SIGTERM");
      setTimeout(() => {
        if (!isResolved) {
          Logger.warn(`[cmd:${commandId}] SIGKILL after grace period`);
          childProcess.kill("SIGKILL");
        }
      }, 5000);
    }, timeoutMs);

    childProcess.stdout.on("data", (data: Buffer) => {
      stdoutChunks.push(data);
      if (onProgress) {
        onProgress(data.toString());
      }
    });

    childProcess.stderr.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      if (onStderr) {
        onStderr(chunk);
      }
    });

    childProcess.on("error", (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        Logger.error(`Process error:`, error);
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });

    childProcess.on("close", (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timer);
        const stdout = Buffer.concat(stdoutChunks).toString();
        if (code === 0) {
          Logger.commandComplete(commandId, code, stdout.length);
          resolve(stdout.trim());
        } else {
          Logger.commandComplete(commandId, code);
          Logger.error(`Failed with exit code ${code}`);
          const errorMessage = stderr.trim() || "Unknown error";
          reject(new Error(`Command failed with exit code ${code}: ${errorMessage}`));
        }
      }
    });
  });
}
