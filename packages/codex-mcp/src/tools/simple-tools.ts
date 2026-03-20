import type { UnifiedTool } from "@ask-llm/shared";
import { executeCommand } from "@ask-llm/shared";
import { z } from "zod";

const pingArgsSchema = z.object({
  message: z.string().optional().describe("A message to echo back to test the connection"),
});

export const pingTool: UnifiedTool = {
  name: "ping",
  description: "Test connectivity with the MCP server",
  zodSchema: pingArgsSchema,
  annotations: {
    title: "Ping",
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  prompt: {
    description: "Echo test message to verify MCP server is working",
  },
  category: "simple",
  execute: async (args, onProgress) => {
    const message = args.message || "Pong from Codex MCP Server!";
    return executeCommand("echo", [message as string], onProgress);
  },
};
