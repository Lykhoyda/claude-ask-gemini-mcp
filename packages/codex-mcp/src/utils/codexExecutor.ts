import { executeCommand, Logger } from "@ask-llm/shared";
import { CLI, ERROR_MESSAGES, MODELS, STATUS_MESSAGES } from "../constants.js";

interface CodexItemCompleted {
  type: "item.completed";
  item?: {
    type?: string;
    text?: string;
  };
}

interface CodexTurnCompleted {
  type: "turn.completed";
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
  };
}

interface CodexThreadStarted {
  type: "thread.started";
  thread_id?: string;
}

type CodexJsonLine = CodexItemCompleted | CodexTurnCompleted | CodexThreadStarted | { type: string };

export interface CodexExecutorOptions {
  prompt: string;
  model?: string;
  onProgress?: (newOutput: string) => void;
}

export interface CodexExecutorResult {
  response: string;
  threadId: string | undefined;
}

function formatStats(usage: CodexTurnCompleted["usage"]): string {
  if (!usage) return "";
  const parts: string[] = [];
  if (usage.input_tokens != null) parts.push(`${usage.input_tokens.toLocaleString()} input tokens`);
  if (usage.output_tokens != null) parts.push(`${usage.output_tokens.toLocaleString()} output tokens`);
  if (usage.cached_input_tokens != null && usage.cached_input_tokens > 0)
    parts.push(`${usage.cached_input_tokens.toLocaleString()} cached`);
  return parts.length > 0 ? `\n\n[Codex stats: ${parts.join(", ")}]` : "";
}

function parseCodexJsonlOutput(raw: string): CodexExecutorResult {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  let lastAgentMessage: string | undefined;
  let threadId: string | undefined;
  let usage: CodexTurnCompleted["usage"];
  let lastError: string | undefined;

  for (const line of lines) {
    let parsed: CodexJsonLine;
    try {
      parsed = JSON.parse(line) as CodexJsonLine;
    } catch {
      continue;
    }

    if (parsed.type === "thread.started") {
      const thread = parsed as CodexThreadStarted;
      if (thread.thread_id) {
        threadId = thread.thread_id;
      }
    }

    if (parsed.type === "item.completed") {
      const item = (parsed as CodexItemCompleted).item;
      if (item?.type === "agent_message" && typeof item.text === "string" && item.text.length > 0) {
        lastAgentMessage = item.text;
      }
    }

    if (parsed.type === "turn.completed") {
      usage = (parsed as CodexTurnCompleted).usage;
    }

    if (parsed.type === "error") {
      lastError = JSON.stringify(parsed);
    }
  }

  if (lastError && !lastAgentMessage) {
    throw new Error(`Codex error event: ${lastError}`);
  }

  if (!lastAgentMessage) {
    Logger.debug("No agent_message found in Codex JSONL output, using raw text");
    return { response: raw, threadId };
  }

  return {
    response: lastAgentMessage + formatStats(usage),
    threadId,
  };
}

function isQuotaError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return ERROR_MESSAGES.QUOTA_SIGNALS.some((signal) => msg.includes(signal));
}

function buildArgs(prompt: string, model: string): string[] {
  return [CLI.COMMANDS.EXEC, CLI.FLAGS.SKIP_GIT, CLI.FLAGS.EPHEMERAL, CLI.FLAGS.JSON, CLI.FLAGS.MODEL, model, prompt];
}

export async function executeCodexCLI(options: CodexExecutorOptions): Promise<CodexExecutorResult> {
  const model = options.model || MODELS.DEFAULT;
  const args = buildArgs(options.prompt, model);

  try {
    const raw = await executeCommand(CLI.COMMANDS.CODEX, args, options.onProgress);
    return parseCodexJsonlOutput(raw);
  } catch (error) {
    if (isQuotaError(error) && model !== MODELS.FALLBACK) {
      Logger.warn(`${STATUS_MESSAGES.QUOTA_SWITCHING} Falling back to ${MODELS.FALLBACK}.`);
      Logger.debug(`Status: ${STATUS_MESSAGES.FALLBACK_RETRY}`);
      const fallbackArgs = buildArgs(options.prompt, MODELS.FALLBACK);
      try {
        const raw = await executeCommand(CLI.COMMANDS.CODEX, fallbackArgs, options.onProgress);
        Logger.warn(`Successfully executed with ${MODELS.FALLBACK} fallback.`);
        Logger.debug(`Status: ${STATUS_MESSAGES.FALLBACK_SUCCESS}`);
        return parseCodexJsonlOutput(raw);
      } catch (fallbackError) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${MODELS.DEFAULT} quota exceeded, ${MODELS.FALLBACK} fallback also failed: ${fallbackMsg}`);
      }
    }
    throw error;
  }
}
