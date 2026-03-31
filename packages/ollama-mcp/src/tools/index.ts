import { toolRegistry } from "@ask-llm/shared";
import { askOllamaTool } from "./ask-ollama.tool.js";
import { pingTool } from "./simple-tools.js";

toolRegistry.push(askOllamaTool, pingTool);

export { executeTool, getPromptMessage, toolRegistry } from "@ask-llm/shared";
