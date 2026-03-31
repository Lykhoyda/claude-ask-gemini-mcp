export const OLLAMA_HOST_ENV = "OLLAMA_HOST";
export const DEFAULT_BASE_URL = "http://localhost:11434";

export const MODELS = {
  DEFAULT: "qwen2.5-coder:7b",
  FALLBACK: "qwen2.5-coder:1.5b",
} as const;

export const API = {
  CHAT: "/api/chat",
  TAGS: "/api/tags",
} as const;

export const ERROR_MESSAGES = {
  MODEL_NOT_FOUND_SIGNALS: ["not found", "try pulling", "does not exist"],
  NO_PROMPT_PROVIDED:
    "Please provide a prompt for analysis. Ask general questions or describe the code you want reviewed.",
  TOOL_NOT_FOUND: "not found in registry",
  SERVER_UNREACHABLE: "Ollama server is not reachable. Make sure Ollama is running: https://ollama.com",
} as const;

export const STATUS_MESSAGES = {
  MODEL_NOT_FOUND_SWITCHING: "Ollama model not found, switching to fallback model...",
  FALLBACK_RETRY: "Retrying with fallback model...",
  FALLBACK_SUCCESS: "Fallback model completed successfully",
  OLLAMA_RESPONSE: "Ollama response:",
} as const;

export const AVAILABILITY_TIMEOUT_MS = 2000;
