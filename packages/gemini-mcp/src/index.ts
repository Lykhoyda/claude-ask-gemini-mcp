import { createRequire } from "node:module";
import type { BaseToolArguments } from "@ask-llm/shared";
import { createProgressTracker, Logger } from "@ask-llm/shared";
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
    return { name: "ask-gemini-mcp", version: "0.0.0" };
  }
}

const { name, version } = readPackageJson();

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

const server = new McpServer({ name, version });

const PROGRESS_MESSAGES = (op: string) => [
  `${op} - Gemini is analyzing your request...`,
  `${op} - Processing files and generating insights...`,
  `${op} - Creating structured response for your review...`,
  `${op} - Large analysis in progress (this is normal for big requests)...`,
  `${op} - Still working... Gemini takes time for quality results...`,
];

for (const tool of toolRegistry) {
  const shape = (tool.zodSchema as z.ZodObject<z.ZodRawShape>).shape;

  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: shape, annotations: tool.annotations },
    async (args: Record<string, unknown>, extra: ToolExtra): Promise<CallToolResult> => {
      const toolName = tool.name;
      const handle = createProgressTracker(toolName, extra, PROGRESS_MESSAGES(toolName));

      try {
        const toolArgs = args as unknown as BaseToolArguments;
        Logger.toolInvocation(toolName, args);

        const result = await executeTool(toolName, toolArgs, (newOutput) => {
          handle.updateOutput(newOutput);
        });

        await handle.stop(true);

        return {
          content: [{ type: "text", text: result }],
          isError: false,
        };
      } catch (error) {
        await handle.stop(false);
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
  Logger.debug("init ask-gemini-mcp");
  Logger.checkNodeVersion();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.debug("ask-gemini-mcp listening on stdio");
}
