import type { UnifiedTool } from "@ask-llm/shared";
import { z } from "zod";
import { ERROR_MESSAGES, STATUS_MESSAGES } from "../constants.js";
import { executeGeminiCLI } from "../utils/geminiExecutor.js";

const askGeminiArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "The question, code review request, or analysis task to send to Gemini CLI. Use @ syntax to include files (e.g., '@largefile.js explain this')",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "DO NOT set this parameter. The tool automatically uses gemini-3.1-pro-preview (latest) and falls back to Flash on quota errors. Only set this if the user explicitly requests a specific model.",
    ),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask-gemini",
  description:
    "Send a prompt to Gemini CLI (defaults to gemini-3.1-pro-preview with automatic Flash fallback on quota errors). Use for code review, second opinions, analysis, and AI-to-AI collaboration. Do not override the model parameter unless the user explicitly asks.",
  zodSchema: askGeminiArgsSchema,
  annotations: {
    title: "Ask Gemini",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  prompt: {
    description: "Execute Gemini CLI to get Google Gemini's response for code review and analysis.",
  },
  category: "gemini",
  execute: async (args, onProgress) => {
    const { prompt, model } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    const result = await executeGeminiCLI({
      prompt: prompt as string,
      model: model as string | undefined,
      onProgress,
    });

    const sessionLine = result.sessionId ? `\n\n[Session ID: ${result.sessionId}]` : "";
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result.response}${sessionLine}`;
  },
};
