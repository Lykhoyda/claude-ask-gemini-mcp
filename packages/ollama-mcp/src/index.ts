import { createRequire } from "node:module";
import type { BaseToolArguments } from "@ask-llm/shared";
import { Logger, PROTOCOL } from "@ask-llm/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import { executeTool, getPromptMessage, toolRegistry } from "./tools/index.js";

function readPackageJson(): { name: string; version: string } {
  try {
    const require = createRequire(import.meta.url);
    return require("../package.json") as { name: string; version: string };
  } catch {
    return { name: "ask-ollama-mcp", version: "0.0.0" };
  }
}

const { name, version } = readPackageJson();

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const server = new McpServer({ name, version });

let isProcessing = false;
let currentOperationName = "";
let latestOutput = "";

async function sendProgressNotification(extra: ToolExtra, progress: number, total?: number, message?: string) {
  const progressToken = extra._meta?.progressToken;
  if (!progressToken) return;

  try {
    const params: Record<string, unknown> = { progressToken, progress };
    if (total !== undefined) params.total = total;
    if (message) params.message = message;

    await extra.sendNotification({
      method: PROTOCOL.NOTIFICATIONS.PROGRESS,
      params,
    } as ServerNotification);
  } catch (error) {
    Logger.error("Failed to send progress notification:", error);
  }
}

function startProgressUpdates(operationName: string, extra: ToolExtra) {
  isProcessing = true;
  currentOperationName = operationName;
  latestOutput = "";

  const progressMessages = [
    `${operationName} - Ollama is analyzing your request...`,
    `${operationName} - Processing locally...`,
    `${operationName} - Generating response...`,
    `${operationName} - Still working (local inference can take a moment)...`,
  ];

  let messageIndex = 0;
  let progress = 0;

  sendProgressNotification(extra, 0, undefined, `Starting ${operationName}`);

  const progressInterval = setInterval(async () => {
    if (isProcessing) {
      progress += 1;
      const baseMessage = progressMessages[messageIndex % progressMessages.length];
      const outputPreview = latestOutput.slice(-150).trim();
      const message = outputPreview ? `${baseMessage}\nOutput: ...${outputPreview}` : baseMessage;

      await sendProgressNotification(extra, progress, undefined, message);
      messageIndex++;
    } else {
      clearInterval(progressInterval);
    }
  }, PROTOCOL.KEEPALIVE_INTERVAL);

  return { interval: progressInterval };
}

function stopProgressUpdates(progressData: { interval: NodeJS.Timeout }, extra: ToolExtra, success: boolean = true) {
  const operationName = currentOperationName;
  isProcessing = false;
  currentOperationName = "";
  clearInterval(progressData.interval);

  sendProgressNotification(
    extra,
    100,
    100,
    success ? `${operationName} completed successfully` : `${operationName} failed`,
  );
}

for (const tool of toolRegistry) {
  const shape = (tool.zodSchema as z.ZodObject<z.ZodRawShape>).shape;

  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: shape, annotations: tool.annotations },
    async (args: Record<string, unknown>, extra: ToolExtra): Promise<CallToolResult> => {
      const toolName = tool.name;
      const progressData = startProgressUpdates(toolName, extra);

      try {
        const toolArgs = args as unknown as BaseToolArguments;
        Logger.toolInvocation(toolName, args);

        const result = await executeTool(toolName, toolArgs, (newOutput) => {
          latestOutput = newOutput;
        });

        stopProgressUpdates(progressData, extra, true);

        return {
          content: [{ type: "text", text: result }],
          isError: false,
        };
      } catch (error) {
        stopProgressUpdates(progressData, extra, false);
        Logger.error(`Error in tool '${toolName}':`, error);

        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          content: [{ type: "text", text: `Error executing ${toolName}: ${errorMessage}` }],
          isError: true,
        };
      }
    },
  );
}

for (const tool of toolRegistry) {
  if (!tool.prompt) continue;

  server.registerPrompt(tool.name, { description: tool.prompt.description }, async (args: Record<string, string>) => {
    const promptMessage = getPromptMessage(tool.name, args);
    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: promptMessage },
        },
      ],
    };
  });
}

export function createSandboxServer(): McpServer {
  const sandbox = new McpServer({ name, version });

  for (const tool of toolRegistry) {
    const shape = (tool.zodSchema as z.ZodObject<z.ZodRawShape>).shape;
    sandbox.registerTool(tool.name, { description: tool.description, inputSchema: shape }, async () => ({
      content: [{ type: "text" as const, text: "Sandbox mode" }],
      isError: false,
    }));
  }

  for (const tool of toolRegistry) {
    if (!tool.prompt) continue;
    sandbox.registerPrompt(tool.name, { description: tool.prompt.description }, async () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: "Sandbox" } }],
    }));
  }

  return sandbox;
}

export async function startServer() {
  Logger.debug("init ask-ollama-mcp");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.debug("ask-ollama-mcp listening on stdio");
}
