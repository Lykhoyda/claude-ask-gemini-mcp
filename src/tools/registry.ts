import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import type { ToolArguments } from "../constants.js";

export interface UnifiedTool {
  name: string;
  description: string;
  zodSchema: ZodTypeAny;
  annotations?: ToolAnnotations;

  prompt?: {
    description: string;
    arguments?: Array<{
      name: string;
      description: string;
      required: boolean;
    }>;
  };

  execute: (args: ToolArguments, onProgress?: (newOutput: string) => void) => Promise<string>;
  category?: "simple" | "gemini" | "utility";
}

export const toolRegistry: UnifiedTool[] = [];

export async function executeTool(
  toolName: string,
  args: ToolArguments,
  onProgress?: (newOutput: string) => void,
): Promise<string> {
  const tool = toolRegistry.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  try {
    const validatedArgs = tool.zodSchema.parse(args);
    return tool.execute(validatedArgs, onProgress);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
      throw new Error(`Invalid arguments for ${toolName}: ${issues}`);
    }
    throw error;
  }
}

export function getPromptMessage(toolName: string, args: Record<string, string>): string {
  const tool = toolRegistry.find((t) => t.name === toolName);
  if (!tool?.prompt) {
    throw new Error(`No prompt defined for tool: ${toolName}`);
  }
  const paramStrings: string[] = [];

  if (args.prompt) {
    paramStrings.push(args.prompt);
  }

  Object.entries(args).forEach(([key, value]) => {
    if (key !== "prompt" && value !== undefined && value !== null && value !== "false") {
      if (value === "true") {
        paramStrings.push(`[${key}]`);
      } else {
        paramStrings.push(`(${key}: ${value})`);
      }
    }
  });

  return `Use the ${toolName} tool${paramStrings.length > 0 ? `: ${paramStrings.join(" ")}` : ""}`;
}
