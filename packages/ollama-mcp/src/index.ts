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
    return { name: "ask-ollama-mcp", version: "0.0.0" };
  }
}

const { name, version } = readPackageJson();

const PROGRESS_MESSAGES = (op: string) => [
  `${op} - Ollama is analyzing your request...`,
  `${op} - Processing locally...`,
  `${op} - Generating response...`,
  `${op} - Still working (local inference can take a moment)...`,
];

const server = new McpServer({ name, version });

registerTools({ server, tools: toolRegistry, executeTool, getPromptMessage, progressMessages: PROGRESS_MESSAGES });

export function createSandboxServer() {
  return createSandboxServerFn({ name, version }, toolRegistry);
}

export async function startServer() {
  Logger.debug("init ask-ollama-mcp");
  Logger.checkNodeVersion();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  Logger.debug("ask-ollama-mcp listening on stdio");
}
