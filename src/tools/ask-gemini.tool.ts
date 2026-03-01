import { z } from "zod";
import { ERROR_MESSAGES, STATUS_MESSAGES } from "../constants.js";
import { executeGeminiCLI, processChangeModeOutput } from "../utils/geminiExecutor.js";
import type { UnifiedTool } from "./registry.js";

const askGeminiArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "DO NOT set this parameter. The tool automatically uses gemini-3.1-pro-preview (latest) and falls back to Flash on quota errors. Only set this if the user explicitly requests a specific model.",
    ),
  sandbox: z
    .boolean()
    .default(false)
    .describe(
      "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment",
    ),
  changeMode: z
    .boolean()
    .default(false)
    .describe(
      "Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly",
    ),
  sessionId: z
    .string()
    .optional()
    .describe(
      "Resume a previous Gemini conversation. Pass the session_id from a prior ask-gemini response to continue a multi-turn exchange with full context.",
    ),
  includeDirs: z
    .array(z.string())
    .optional()
    .describe(
      "Additional directories to include in Gemini's context via --include-directories. Useful for monorepos where the code you want analyzed lives outside the current working directory.",
    ),
  chunkIndex: z.union([z.number(), z.string()]).optional().describe("Which chunk to return (1-based)"),
  chunkCacheKey: z.string().optional().describe("Optional cache key for continuation"),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description:
    "Send a prompt to Gemini CLI (defaults to gemini-3.1-pro-preview with automatic Flash fallback on quota errors). Supports sandbox mode [-s], changeMode for structured edits, multi-turn sessions via sessionId, and additional directory context via includeDirs. Do not override the model parameter unless the user explicitly asks.",
  zodSchema: askGeminiArgsSchema,
  annotations: {
    title: "Ask Gemini",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  prompt: {
    description:
      "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: "gemini",
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, changeMode, sessionId, includeDirs, chunkIndex, chunkCacheKey } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    if (changeMode && chunkIndex && chunkCacheKey) {
      return processChangeModeOutput("", chunkIndex as number, chunkCacheKey as string, prompt as string);
    }

    const result = await executeGeminiCLI({
      prompt: prompt as string,
      model: model as string | undefined,
      sandbox: !!sandbox,
      changeMode: !!changeMode,
      sessionId: sessionId as string | undefined,
      includeDirs: includeDirs as string[] | undefined,
      onProgress,
    });

    const sessionLine = result.sessionId ? `\n\n[Session ID: ${result.sessionId}]` : "";

    if (changeMode) {
      const changeModeOutput = processChangeModeOutput(
        result.response,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string,
      );
      return `${changeModeOutput}${sessionLine}`;
    }

    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result.response}${sessionLine}`;
  },
};
