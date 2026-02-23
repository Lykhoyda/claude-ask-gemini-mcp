import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { UnifiedTool } from "../registry.js";
import { executeTool, getPromptMessage, toolRegistry } from "../registry.js";

const testTool: UnifiedTool = {
  name: "test-tool",
  description: "A test tool",
  zodSchema: z.object({
    input: z.string(),
    count: z.number().optional(),
  }),
  prompt: {
    description: "Run the test tool",
    arguments: [{ name: "input", description: "The input string", required: true }],
  },
  execute: async (args) => `echo: ${args.input}`,
};

describe("executeTool", () => {
  it("executes a registered tool with valid args", async () => {
    toolRegistry.push(testTool);

    try {
      const result = await executeTool("test-tool", { input: "hello" });
      expect(result).toBe("echo: hello");
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("throws on invalid Zod args", async () => {
    toolRegistry.push(testTool);

    try {
      await expect(executeTool("test-tool", { input: 123 as unknown as string })).rejects.toThrow(
        "Invalid arguments for test-tool",
      );
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("throws on unknown tool name", async () => {
    await expect(executeTool("nonexistent-tool", {})).rejects.toThrow("Unknown tool: nonexistent-tool");
  });
});

describe("getPromptMessage", () => {
  it("formats prompt with tool name", () => {
    toolRegistry.push(testTool);

    try {
      const result = getPromptMessage("test-tool", {});
      expect(result).toContain("Use the test-tool tool");
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("includes prompt param in output", () => {
    toolRegistry.push(testTool);

    try {
      const result = getPromptMessage("test-tool", { prompt: "analyze this" });
      expect(result).toContain("analyze this");
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("formats boolean true params as brackets", () => {
    toolRegistry.push(testTool);

    try {
      const result = getPromptMessage("test-tool", { sandbox: "true" });
      expect(result).toContain("[sandbox]");
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("formats string params as parenthesized key-value", () => {
    toolRegistry.push(testTool);

    try {
      const result = getPromptMessage("test-tool", { model: "gemini-3-flash-preview" });
      expect(result).toContain("(model: gemini-3-flash-preview)");
    } finally {
      const idx = toolRegistry.findIndex((t) => t.name === "test-tool");
      if (idx !== -1) toolRegistry.splice(idx, 1);
    }
  });

  it("throws for tool without prompt definition", async () => {
    expect(() => getPromptMessage("nonexistent-tool", {})).toThrow("No prompt defined for tool");
  });
});
