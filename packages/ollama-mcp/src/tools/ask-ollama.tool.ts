import type { UnifiedTool } from "@ask-llm/shared";
import { z } from "zod";
import { ERROR_MESSAGES, STATUS_MESSAGES } from "../constants.js";
import { executeOllamaCLI } from "../utils/ollamaExecutor.js";

const askOllamaArgsSchema = z.object({
  prompt: z.string().min(1).describe("The question, code review request, or analysis task to send to Ollama"),
  model: z
    .string()
    .optional()
    .describe(
      "DO NOT set this parameter. The tool automatically uses qwen2.5-coder:7b and falls back to qwen2.5-coder:1.5b if not found. Only set this if the user explicitly requests a specific model.",
    ),
});

export const askOllamaTool: UnifiedTool = {
  name: "ask-ollama",
  description:
    "Send a prompt to a local Ollama LLM (defaults to qwen2.5-coder:7b with automatic fallback). Use for code review, second opinions, analysis, and AI-to-AI collaboration. Runs entirely locally — no API keys or network calls needed.",
  zodSchema: askOllamaArgsSchema,
  annotations: {
    title: "Ask Ollama",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  prompt: {
    description: "Execute Ollama to get a local LLM response for code review and analysis.",
  },
  category: "ollama",
  execute: async (args, onProgress) => {
    const { prompt, model } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    const result = await executeOllamaCLI({
      prompt: prompt as string,
      model: model as string | undefined,
      onProgress,
    });

    return `${STATUS_MESSAGES.OLLAMA_RESPONSE}\n${result.response}`;
  },
};
