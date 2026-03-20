import { toolRegistry } from "@ask-llm/shared";
import { askCodexTool } from "./ask-codex.tool.js";
import { pingTool } from "./simple-tools.js";

toolRegistry.push(askCodexTool, pingTool);

export { executeTool, getPromptMessage, toolRegistry } from "@ask-llm/shared";
