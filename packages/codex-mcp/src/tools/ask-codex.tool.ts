import type { UnifiedTool } from "@ask-llm/shared";
import { z } from "zod";
import { ERROR_MESSAGES, MODELS, STATUS_MESSAGES } from "../constants.js";
import { executeCodexCLI } from "../utils/codexExecutor.js";

const askCodexArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(100000)
    .describe("The question, code review request, or analysis task to send to Codex CLI"),
  model: z
    .string()
    .optional()
    .describe(
      `DO NOT set this parameter. The tool automatically uses ${MODELS.DEFAULT} and falls back to ${MODELS.FALLBACK} on quota errors. Only set this if the user explicitly requests a specific model.`,
    ),
});

export const askCodexTool: UnifiedTool = {
  name: "ask-codex",
  description:
    "Send a prompt to OpenAI Codex CLI (defaults to gpt-5.4 with automatic fallback on quota errors). Use for code review, second opinions, analysis, and AI-to-AI collaboration. Do not override the model parameter unless the user explicitly asks.",
  zodSchema: askCodexArgsSchema,
  annotations: {
    title: "Ask Codex",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  prompt: {
    description: "Execute Codex CLI to get OpenAI Codex's response for code review and analysis.",
  },
  category: "codex",
  execute: async (args, onProgress) => {
    const { prompt, model } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    const result = await executeCodexCLI({
      prompt: prompt as string,
      model: model as string | undefined,
      onProgress,
    });

    const threadLine = result.threadId ? `\n\n[Thread ID: ${result.threadId}]` : "";

    return `${STATUS_MESSAGES.CODEX_RESPONSE}\n${result.response}${threadLine}`;
  },
};
