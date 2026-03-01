// Logging
export const LOG_PREFIX = "[GMCPT]";

// Error messages
export const ERROR_MESSAGES = {
  QUOTA_EXCEEDED: "RESOURCE_EXHAUSTED",
  QUOTA_EXCEEDED_SHORT: "⚠️ Gemini Pro daily quota exceeded. Please retry with model: 'gemini-3-flash-preview'",
  TOOL_NOT_FOUND: "not found in registry",
  NO_PROMPT_PROVIDED:
    "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
} as const;

// Status messages
export const STATUS_MESSAGES = {
  QUOTA_SWITCHING: "🚫 Gemini Pro quota exceeded, switching to Flash model...",
  FLASH_RETRY: "⚡ Retrying with Gemini Flash...",
  FLASH_SUCCESS: "✅ Flash model completed successfully",
  SANDBOX_EXECUTING: "🔒 Executing Gemini CLI command in sandbox mode...",
  GEMINI_RESPONSE: "Gemini response:",
  // Timeout prevention messages
  PROCESSING_START: "🔍 Starting analysis (may take 5-15 minutes for large codebases)",
  PROCESSING_CONTINUE: "⏳ Still processing... Gemini is working on your request",
  PROCESSING_COMPLETE: "✅ Analysis completed successfully",
} as const;

// Models
export const MODELS = {
  PRO: "gemini-3.1-pro-preview",
  FLASH: "gemini-3-flash-preview",
} as const;

// MCP Protocol Constants
export const PROTOCOL = {
  // Message roles
  ROLES: {
    USER: "user",
    ASSISTANT: "assistant",
  },
  // Content types
  CONTENT_TYPES: {
    TEXT: "text",
  },
  // Status codes
  STATUS: {
    SUCCESS: "success",
    ERROR: "error",
    FAILED: "failed",
    REPORT: "report",
  },
  // Notification methods
  NOTIFICATIONS: {
    PROGRESS: "notifications/progress",
  },
  // Timeout prevention
  KEEPALIVE_INTERVAL: 25000, // 25 seconds
} as const;

// CLI Constants
export const CLI = {
  // Command names
  COMMANDS: {
    GEMINI: "gemini",
    ECHO: "echo",
  },
  // Command flags
  FLAGS: {
    MODEL: "-m",
    SANDBOX: "-s",
    PROMPT: "-p",
    OUTPUT_FORMAT: "--output-format",
    RESUME: "--resume",
    INCLUDE_DIRECTORIES: "--include-directories",
  },
  // Output format values
  OUTPUT_FORMATS: {
    JSON: "json",
  },
  // Default values
  DEFAULTS: {
    MODEL: "default", // Fallback model used when no specific model is provided
    BOOLEAN_TRUE: "true",
    BOOLEAN_FALSE: "false",
  },
} as const;

// Execution limits
export const EXECUTION = {
  DEFAULT_TIMEOUT_MS: 300_000,
  TIMEOUT_ENV_VAR: "GMCPT_TIMEOUT_MS",
  ERROR_TRUNCATE_LENGTH: 2000,
} as const;

// Logging
export const LOG_LEVEL_ENV_VAR = "GMCPT_LOG_LEVEL";

// (merged PromptArguments and ToolArguments)
export interface ToolArguments {
  prompt?: string;
  model?: string;
  sandbox?: boolean | string;
  changeMode?: boolean | string;
  sessionId?: string;
  includeDirs?: string[];
  chunkIndex?: number | string; // Which chunk to return (1-based)
  chunkCacheKey?: string; // Optional cache key for continuation
  message?: string;

  [key: string]: string | boolean | number | string[] | undefined;
}
