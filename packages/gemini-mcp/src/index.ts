import { createRequire } from "node:module";
import { createSandboxServer as createSandboxServerFn, Logger, registerTools } from "@ask-llm/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const PROGRESS_MESSAGES = (op: string) => [
  `${op} - Gemini is analyzing your request...`,
  `${op} - Processing files and generating insights...`,
  `${op} - Creating structured response for your review...`,
  `${op} - Large analysis in progress (this is normal for big requests)...`,
  `${op} - Still working... Gemini takes time for quality results...`,
];

const server = new McpServer({ name, version });

registerTools({ server, tools: toolRegistry, executeTool, getPromptMessage, progressMessages: PROGRESS_MESSAGES });

export function createSandboxServer() {
  return createSandboxServerFn({ name, version }, toolRegistry);
}

export async function startServer() {
  Logger.debug("init ask-gemini-mcp");
  Logger.checkNodeVersion();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.debug("ask-gemini-mcp listening on stdio");
}
