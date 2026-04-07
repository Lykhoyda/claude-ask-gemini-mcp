import type { BaseToolArguments } from "@ask-llm/shared";

export const QUOTA_PATTERNS = [
  "RESOURCE_EXHAUSTED",
  "TerminalQuotaError",
  "exhausted your capacity",
] as const;

export const ERROR_MESSAGES = {
  QUOTA_EXCEEDED: "RESOURCE_EXHAUSTED",
  QUOTA_EXCEEDED_SHORT: "⚠️ Gemini Pro daily quota exceeded. Please retry with model: 'gemini-3-flash-preview'",
  TOOL_NOT_FOUND: "not found in registry",
  NO_PROMPT_PROVIDED:
    "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
} as const;

export const STATUS_MESSAGES = {
  QUOTA_SWITCHING: "🚫 Gemini Pro quota exceeded, switching to Flash model...",
  FLASH_RETRY: "⚡ Retrying with Gemini Flash...",
  FLASH_SUCCESS: "✅ Flash model completed successfully",
  SANDBOX_EXECUTING: "🔒 Executing Gemini CLI command in sandbox mode...",
  GEMINI_RESPONSE: "Gemini response:",
  PROCESSING_START: "🔍 Starting analysis (may take 5-15 minutes for large codebases)",
  PROCESSING_CONTINUE: "⏳ Still processing... Gemini is working on your request",
  PROCESSING_COMPLETE: "✅ Analysis completed successfully",
} as const;

export const MODELS = {
  PRO: process.env.ASK_GEMINI_MODEL || "gemini-3.1-pro-preview",
  FLASH: process.env.ASK_GEMINI_FALLBACK_MODEL || "gemini-3-flash-preview",
};

export const CLI = {
  COMMANDS: {
    GEMINI: "gemini",
    ECHO: "echo",
  },
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    OUTPUT_FORMAT: "--output-format",
    RESUME: "--resume",
    INCLUDE_DIRECTORIES: "--include-directories",
  },
  OUTPUT_FORMATS: {
    JSON: "json",
  },
  DEFAULTS: {
    MODEL: "default",
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
  },
} as const;

export interface ToolArguments extends BaseToolArguments {
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string;
  sessionId?: string;
  includeDirs?: string[];
  chunkIndex?: number | string;
  chunkCacheKey?: string;
}
