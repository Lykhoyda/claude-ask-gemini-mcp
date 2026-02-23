// Tool Registry Index - Registers all tools

import { askGeminiTool } from "./ask-gemini.tool.js";
import { fetchChunkTool } from "./fetch-chunk.tool.js";
import { toolRegistry } from "./registry.js";
import { pingTool } from "./simple-tools.js";

toolRegistry.push(askGeminiTool, fetchChunkTool, pingTool);

export * from "./registry.js";
