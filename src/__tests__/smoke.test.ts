import { describe, expect, it } from "vitest";
import { toolRegistry } from "../tools/index.js";

describe("MCP server smoke test", () => {
  const expectedTools = ["ask-gemini", "fetch-chunk", "ping"];

  it("has exactly 3 tools registered", () => {
    const toolNames = toolRegistry.map((t) => t.name);
    expect(toolNames).toEqual(expect.arrayContaining(expectedTools));
    expect(toolNames).toHaveLength(expectedTools.length);
  });

  for (const toolName of expectedTools) {
    it(`tool "${toolName}" has required properties`, () => {
      const tool = toolRegistry.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(toolName);
      expect(tool?.description).toBeTruthy();
      expect(tool?.zodSchema).toBeDefined();
      expect(typeof tool?.execute).toBe("function");
    });
  }
});
