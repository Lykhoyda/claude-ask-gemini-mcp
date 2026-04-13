import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { CallToolResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { BaseToolArguments } from "./constants.js";
import { Logger } from "./logger.js";
import { createProgressTracker } from "./progressTracker.js";
import type { UnifiedTool } from "./registry.js";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

interface RegisterToolsOptions {
  server: McpServer;
  tools: UnifiedTool[];
  executeTool: (name: string, args: BaseToolArguments, onProgress?: (output: string) => void) => Promise<string>;
  getPromptMessage: (name: string, args: Record<string, string>) => string;
  progressMessages: (op: string) => string[];
}

export function registerTools({
  server,
  tools,
  executeTool,
  getPromptMessage,
  progressMessages,
}: RegisterToolsOptions) {
  for (const tool of tools) {
    const shape = (tool.zodSchema as z.ZodObject<z.ZodRawShape>).shape;

    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: shape, annotations: tool.annotations },
      async (args: Record<string, unknown>, extra: ToolExtra): Promise<CallToolResult> => {
        const toolName = tool.name;
        const handle = createProgressTracker(toolName, extra, progressMessages(toolName));

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

  for (const tool of tools) {
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
}

export function createSandboxServer(meta: { name: string; version: string }, tools: UnifiedTool[]): McpServer {
  const sandbox = new McpServer(meta);

  for (const tool of tools) {
    const shape = (tool.zodSchema as z.ZodObject<z.ZodRawShape>).shape;
    sandbox.registerTool(tool.name, { description: tool.description, inputSchema: shape }, async () => ({
      content: [{ type: "text" as const, text: "Sandbox mode" }],
      isError: false,
    }));
  }

  for (const tool of tools) {
    if (!tool.prompt) continue;
    sandbox.registerPrompt(tool.name, { description: tool.prompt.description }, async () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: "Sandbox" } }],
    }));
  }

  return sandbox;
}
