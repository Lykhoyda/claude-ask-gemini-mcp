export const ERROR_MESSAGES = {
  QUOTA_SIGNALS: ["rate_limit_exceeded", "quota_exceeded", "429", "insufficient_quota"],
  NO_PROMPT_PROVIDED:
    "Please provide a prompt for analysis. Ask general questions or describe the code you want reviewed.",
  TOOL_NOT_FOUND: "not found in registry",
} as const;

export const STATUS_MESSAGES = {
  QUOTA_SWITCHING: "Codex quota exceeded, switching to fallback model...",
  FALLBACK_RETRY: "Retrying with fallback model...",
  FALLBACK_SUCCESS: "Fallback model completed successfully",
  CODEX_RESPONSE: "Codex response:",
} as const;

export const MODELS = {
  DEFAULT: process.env.ASK_CODEX_MODEL || "gpt-5.5",
  FALLBACK: process.env.ASK_CODEX_FALLBACK_MODEL || "gpt-5.5-mini",
};

export const CLI = {
  COMMANDS: {
    CODEX: "codex",
    EXEC: "exec",
    RESUME: "resume",
  },
  FLAGS: {
    MODEL: "-m",
    SKIP_GIT: "--skip-git-repo-check",
    EPHEMERAL: "--ephemeral",
    JSON: "--json",
    FULL_AUTO: "--full-auto",
    IGNORE_USER_CONFIG: "--ignore-user-config",
    IGNORE_RULES: "--ignore-rules",
  },
} as const;
