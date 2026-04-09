import { createRequire } from "node:module";
import { createProgressTracker, Logger } from "@ask-llm/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { INSTALL_HINTS, PROVIDERS } from "./constants.js";
import { isCommandAvailable } from "./utils/availability.js";

function readPackageJson(): { name: string; version: string } {
  try {
    const require = createRequire(import.meta.url);
    return require("../package.json") as { name: string; version: string };
  } catch {
    return { name: "ask-llm-mcp", version: "0.0.0" };
  }
}

export interface ProviderStatus {
  available: string[];
  missing: string[];
}

type ExecutorFn = (options: { prompt: string; model?: string; onProgress?: (output: string) => void }) => Promise<{
  response: string;
}>;

const loadedExecutors = new Map<string, ExecutorFn>();

export async function detectProviders(): Promise<ProviderStatus> {
  const available: string[] = [];
  const missing: string[] = [];

  const checks = await Promise.all(
    Object.entries(PROVIDERS).map(async ([key, provider]) => {
      let found: boolean;
      if (provider.availabilityModule && provider.availabilityFn) {
        try {
          const mod = await import(provider.availabilityModule);
          found = await (mod[provider.availabilityFn] as () => Promise<boolean>)();
        } catch {
          found = false;
        }
      } else {
        found = await isCommandAvailable(provider.command);
      }
      return { key, provider, found };
    }),
  );

  for (const { key, provider, found } of checks) {
    if (found) {
      try {
        const mod = await import(provider.executorModule);
        loadedExecutors.set(key, mod[provider.executorFn] as ExecutorFn);
        available.push(key);
        Logger.warn(`Provider ${provider.name} (${provider.command}) — available`);
      } catch (err) {
        missing.push(key);
        Logger.error(`Provider ${provider.name} — import failed:`, err);
      }
    } else {
      missing.push(key);
      const hint = INSTALL_HINTS[key] ?? "";
      Logger.warn(`Provider ${provider.name} (${provider.command}) — not found${hint ? `. Install: ${hint}` : ""}`);
    }
  }

  if (available.length === 0) {
    Logger.warn("No LLM providers found. Install at least one CLI to enable AI tools.");
    for (const [key, hint] of Object.entries(INSTALL_HINTS)) {
      Logger.warn(`  ${PROVIDERS[key]?.name ?? key}: ${hint}`);
    }
  }

  return { available, missing };
}

function buildAskLlmSchema(availableProviders: string[]) {
  const providerEnum = availableProviders.length > 0 ? availableProviders : Object.keys(PROVIDERS);
  const providerDescriptions = providerEnum
    .map((k) => {
      const p = PROVIDERS[k];
      return p ? `"${k}" (${p.name}, default model: ${p.defaultModel})` : k;
    })
    .join(", ");

  return z.object({
    provider: z
      .enum(providerEnum as [string, ...string[]])
      .describe(`Which LLM provider to use. Available: ${providerDescriptions}`),
    prompt: z.string().min(1).max(100000).describe("The question, code review request, or analysis task to send"),
    model: z.string().optional().describe("Override the default model. Usually not needed."),
  });
}

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const PROGRESS_MESSAGES = (op: string) => [
  `${op} - Processing your request...`,
  `${op} - Generating insights...`,
  `${op} - Large analysis in progress...`,
  `${op} - Still working...`,
];

export async function startServer() {
  Logger.debug("init ask-llm-mcp");
  Logger.checkNodeVersion();
  const { name, version } = readPackageJson();
  const { available } = await detectProviders();

  const server = new McpServer({ name, version });

  const askLlmSchema = buildAskLlmSchema(available);

  server.registerTool(
    "ask-llm",
    {
      description:
        "Send a prompt to an LLM provider (Gemini, Codex, Ollama). Specify which provider to use. Each provider auto-selects its best model with fallback on errors.",
      inputSchema: askLlmSchema.shape,
      annotations: { title: "Ask LLM", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args: Record<string, unknown>, extra: ToolExtra): Promise<CallToolResult> => {
      const progress = createProgressTracker("ask-llm", extra, PROGRESS_MESSAGES("ask-llm"));
      try {
        const { provider, prompt, model } = askLlmSchema.parse(args);
        Logger.toolInvocation("ask-llm", args);

        const executor = loadedExecutors.get(provider);
        if (!executor) {
          const hint = INSTALL_HINTS[provider] ?? "";
          throw new Error(
            `Provider "${provider}" is not available. ${hint ? `Install: ${hint}` : "Check that the CLI is on your PATH."}`,
          );
        }

        const result = await executor({
          prompt,
          model,
          onProgress: (output) => {
            progress.updateOutput(output);
          },
        });

        await progress.stop(true);
        const providerName = PROVIDERS[provider]?.name ?? provider;
        return { content: [{ type: "text", text: `${providerName} response:\n${result.response}` }], isError: false };
      } catch (error) {
        await progress.stop(false);
        const msg = error instanceof Error ? error.message : String(error);
        Logger.error("ask-llm error:", error);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  const pingSchema = z.object({
    message: z.string().optional().describe("A message to echo back to test the connection"),
  });

  server.registerTool(
    "ping",
    {
      description: "Test connectivity with the MCP server",
      inputSchema: pingSchema.shape,
      annotations: { title: "Ping", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args: Record<string, unknown>): Promise<CallToolResult> => {
      const { message } = pingSchema.parse(args);
      const providers = available.length > 0 ? available.join(", ") : "none";
      const text = message || `Pong from ask-llm-mcp! Available providers: ${providers}`;
      return { content: [{ type: "text", text }], isError: false };
    },
  );

  Logger.warn(`ask-llm-mcp v${version} — 2 tools, ${available.length} provider(s): ${available.join(", ") || "none"}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.debug("ask-llm-mcp listening on stdio");
}
