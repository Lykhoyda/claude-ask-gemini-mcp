export const LOG_PREFIX = "[GMCPT]";

export const LOG_LEVEL_ENV_VAR = "GMCPT_LOG_LEVEL";

export const PROTOCOL = {
  ROLES: {
    USER: "user",
    ASSISTANT: "assistant",
  },
  CONTENT_TYPES: {
    TEXT: "text",
  },
  STATUS: {
    SUCCESS: "success",
    ERROR: "error",
    FAILED: "failed",
    REPORT: "report",
  },
  NOTIFICATIONS: {
    PROGRESS: "notifications/progress",
  },
  KEEPALIVE_INTERVAL: 25000,
} as const;

export const EXECUTION = {
  DEFAULT_TIMEOUT_MS: 210_000,
  TIMEOUT_ENV_VAR: "GMCPT_TIMEOUT_MS",
  ERROR_TRUNCATE_LENGTH: 2000,
} as const;

export interface BaseToolArguments {
  prompt?: string;
  message?: string;
  [key: string]: string | boolean | number | string[] | undefined;
}
