import { z } from "zod";
import { executeCommand } from "../utils/commandExecutor.js";
import type { UnifiedTool } from "./registry.js";

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
    const message = args.message || "Pong from Gemini MCP Server!";
    return executeCommand("echo", [message], onProgress);
  },
};
