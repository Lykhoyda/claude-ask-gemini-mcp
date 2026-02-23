import { spawn } from "node:child_process";
import { EXECUTION } from "../constants.js";
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

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const commandId = Logger.commandExecution(command, args);

    const childProcess = spawn(command, args, {
      env: process.env,
      shell: IS_WINDOWS,
      stdio: ["ignore", "pipe", "pipe"],
    });

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
      stderr += data.toString();
      if (stderr.includes("RESOURCE_EXHAUSTED")) {
        const modelMatch = stderr.match(/Quota exceeded for quota metric '([^']+)'/);
        const statusMatch = stderr.match(/status["\s]*[:=]\s*(\d+)/);
        const reasonMatch = stderr.match(/"reason":\s*"([^"]+)"/);
        const model = modelMatch ? modelMatch[1] : "Unknown Model";
        const status = statusMatch ? statusMatch[1] : "429";
        const reason = reasonMatch ? reasonMatch[1] : "rateLimitExceeded";
        const errorJson = {
          error: {
            code: parseInt(status, 10),
            message: `GMCPT: --> Quota exceeded for ${model}`,
            details: {
              model: model,
              reason: reason,
              statusText: "Too Many Requests -- > try using gemini-2.5-flash by asking",
            },
          },
        };
        Logger.error(`Gemini Quota Error: ${JSON.stringify(errorJson, null, 2)}`);
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
