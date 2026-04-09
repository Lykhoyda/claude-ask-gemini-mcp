import { spawn } from "node:child_process";
import { EXECUTION } from "./constants.js";
import { Logger } from "./logger.js";
import { getSpawnEnv } from "./shellPath.js";

const IS_WINDOWS = process.platform === "win32";

export function sanitizeErrorForLLM(stderr: string, command: string): string {
  if (stderr.includes("Invalid regular expression flags") && stderr.includes("Node.js v")) {
    const nodeVersion = stderr.match(/Node\.js (v[\d.]+)/)?.[1] ?? "unknown";
    return `${command} CLI requires Node.js v20+ but is running on ${nodeVersion}. The user should update their Node version or set ASK_LLM_PATH in their MCP config to point to a Node v20+ installation.`;
  }

  if (stderr.includes("command not found") || stderr.includes("ENOENT")) {
    return `${command} CLI not found on PATH. Ensure it is installed and accessible. Run "which ${command}" in a terminal to verify.`;
  }

  if (stderr.includes("EACCES") || stderr.includes("Permission denied")) {
    return `Permission denied when running ${command} CLI. Check file permissions and try running with appropriate access.`;
  }

  const firstLine = stderr.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length < 300) {
    return firstLine;
  }

  return stderr.length > 500 ? `${stderr.slice(0, 500)}... (truncated)` : stderr;
}

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
      env: getSpawnEnv(),
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
      isResolved = true;
      Logger.warn(`[cmd:${commandId}] Timeout after ${timeoutMs}ms, sending SIGTERM`);
      childProcess.kill("SIGTERM");
      setTimeout(() => {
        try {
          childProcess.kill("SIGKILL");
        } catch {}
      }, 5000);
      const timeoutSec = Math.round(timeoutMs / 1000);
      reject(
        new Error(
          `Command timed out after ${timeoutSec}s. The LLM provider took too long to respond. ` +
            `Try a shorter prompt or increase the timeout via GMCPT_TIMEOUT_MS environment variable (current: ${timeoutMs}ms).`,
        ),
      );
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
          const rawError = stderr.trim() || "Unknown error";
          const userMessage = sanitizeErrorForLLM(rawError, command);
          reject(new Error(userMessage));
        }
      }
    });
  });
}
