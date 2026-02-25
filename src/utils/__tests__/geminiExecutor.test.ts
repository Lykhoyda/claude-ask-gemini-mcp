import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLI, MODELS } from "../../constants.js";

vi.mock("../commandExecutor.js", () => ({
  executeCommand: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  Logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { executeCommand } from "../commandExecutor.js";
import { executeGeminiCLI } from "../geminiExecutor.js";

const mockExecuteCommand = vi.mocked(executeCommand);

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteCommand.mockResolvedValue("Gemini response");
});

describe("executeGeminiCLI argument construction", () => {
  it("uses -p flag (not -- separator) to pass prompt", async () => {
    await executeGeminiCLI("explain this code");

    expect(mockExecuteCommand).toHaveBeenCalledOnce();
    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("-p");
    expect(args).not.toContain("--");
  });

  it("passes prompt immediately after -p flag", async () => {
    await executeGeminiCLI("explain this code");

    const [, args] = mockExecuteCommand.mock.calls[0];
    const flagIndex = args.indexOf("-p");
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(args[flagIndex + 1]).toBe("explain this code");
  });

  it("builds basic args with only prompt", async () => {
    await executeGeminiCLI("hello");

    const [cmd, args] = mockExecuteCommand.mock.calls[0];
    expect(cmd).toBe(CLI.COMMANDS.GEMINI);
    expect(args).toEqual([CLI.FLAGS.OUTPUT_FORMAT, CLI.OUTPUT_FORMATS.JSON, CLI.FLAGS.PROMPT, "hello"]);
  });

  it("includes -m flag when model is specified", async () => {
    await executeGeminiCLI("hello", "gemini-3-flash-preview");

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.FLAGS.MODEL,
      "gemini-3-flash-preview",
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });

  it("includes -s flag when sandbox is enabled", async () => {
    await executeGeminiCLI("hello", undefined, true);

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.FLAGS.SANDBOX,
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });

  it("includes both model and sandbox flags", async () => {
    await executeGeminiCLI("hello", "gemini-3-flash-preview", true);

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.FLAGS.MODEL,
      "gemini-3-flash-preview",
      CLI.FLAGS.SANDBOX,
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });

  it("prompt flag value is CLI.FLAGS.PROMPT constant", () => {
    expect(CLI.FLAGS.PROMPT).toBe("-p");
  });
});

describe("executeGeminiCLI quota fallback", () => {
  it("retries with Flash model on RESOURCE_EXHAUSTED error", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("Flash response");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
  });

  it("uses -p flag in fallback args too", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI("hello");

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toContain("-p");
    expect(fallbackArgs).not.toContain("--");
    expect(fallbackArgs).toEqual([
      CLI.FLAGS.MODEL,
      MODELS.FLASH,
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });

  it("preserves sandbox flag in fallback args", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI("hello", undefined, true);

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toEqual([
      CLI.FLAGS.MODEL,
      MODELS.FLASH,
      CLI.FLAGS.SANDBOX,
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });

  it("does not retry if already using Flash model", async () => {
    mockExecuteCommand.mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"));

    await expect(executeGeminiCLI("hello", MODELS.FLASH)).rejects.toThrow("RESOURCE_EXHAUSTED");
    expect(mockExecuteCommand).toHaveBeenCalledOnce();
  });

  it("throws combined error when fallback also fails", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockRejectedValueOnce(new Error("Flash also failed"));

    await expect(executeGeminiCLI("hello")).rejects.toThrow(
      `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: Flash also failed`,
    );
  });

  it("re-throws non-quota errors without fallback", async () => {
    mockExecuteCommand.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(executeGeminiCLI("hello")).rejects.toThrow("Connection refused");
    expect(mockExecuteCommand).toHaveBeenCalledOnce();
  });
});

describe("executeGeminiCLI changeMode", () => {
  it("replaces file: syntax with @ syntax in changeMode", async () => {
    await executeGeminiCLI("fix file:src/index.ts and file:src/app.ts", undefined, false, true);

    const [, args] = mockExecuteCommand.mock.calls[0];
    const promptArg = args[args.indexOf(CLI.FLAGS.PROMPT) + 1];
    expect(promptArg).toContain("@src/index.ts");
    expect(promptArg).toContain("@src/app.ts");
    expect(promptArg).not.toContain("file:src/index.ts");
  });

  it("wraps prompt in changeMode instructions", async () => {
    await executeGeminiCLI("fix the bug", undefined, false, true);

    const [, args] = mockExecuteCommand.mock.calls[0];
    const promptArg = args[args.indexOf(CLI.FLAGS.PROMPT) + 1];
    expect(promptArg).toContain("[CHANGEMODE INSTRUCTIONS]");
    expect(promptArg).toContain("OLD:");
    expect(promptArg).toContain("NEW:");
    expect(promptArg).toContain("fix the bug");
  });

  it("still uses -p flag with changeMode enabled", async () => {
    await executeGeminiCLI("fix the bug", undefined, false, true);

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("-p");
    expect(args).not.toContain("--");
  });
});

describe("executeGeminiCLI JSON output format", () => {
  it("always passes --output-format json flag", async () => {
    await executeGeminiCLI("hello");

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  it("passes --output-format json before -p flag", async () => {
    await executeGeminiCLI("hello");

    const [, args] = mockExecuteCommand.mock.calls[0];
    const formatIndex = args.indexOf("--output-format");
    const promptIndex = args.indexOf("-p");
    expect(formatIndex).toBeLessThan(promptIndex);
  });

  it("includes --output-format json in fallback args", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI("hello");

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toContain("--output-format");
    expect(fallbackArgs).toContain("json");
  });

  it("parses JSON response and extracts response text", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "parsed text", stats: {} }));

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("parsed text");
  });

  it("appends stats summary when stats are present", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({
        response: "some response",
        stats: { inputTokens: 1234, outputTokens: 567, model: "gemini-3.1-pro-preview" },
      }),
    );

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("[Gemini stats:");
    expect(result).toContain("1,234 input tokens");
    expect(result).toContain("567 output tokens");
    expect(result).toContain("gemini-3.1-pro-preview");
  });

  it("falls back to raw text when output is not valid JSON", async () => {
    mockExecuteCommand.mockResolvedValueOnce("plain text response");

    const result = await executeGeminiCLI("hello");

    expect(result).toBe("plain text response");
  });

  it("falls back to raw text when JSON has no response field", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ stats: {} }));

    const result = await executeGeminiCLI("hello");

    expect(result).toBe(JSON.stringify({ stats: {} }));
  });

  it("throws when JSON contains an error field", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: { message: "Rate limit exceeded", code: 429 } }));

    await expect(executeGeminiCLI("hello")).rejects.toThrow("Rate limit exceeded");
  });

  it("throws with code when error has no message", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: { code: 503 } }));

    await expect(executeGeminiCLI("hello")).rejects.toThrow("Gemini error code 503");
  });

  it("extracts JSON when CLI prints warnings before JSON object", async () => {
    const json = JSON.stringify({ response: "actual response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`WARNING: something\n${json}`);

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("actual response");
  });

  it("falls back to raw text when output has no JSON object at all", async () => {
    mockExecuteCommand.mockResolvedValueOnce("no json here at all");

    const result = await executeGeminiCLI("hello");

    expect(result).toBe("no json here at all");
  });

  it("extracts JSON when CLI prints trailing text after JSON object", async () => {
    const json = JSON.stringify({ response: "good response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`${json}\nDone in 3.2s`);

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("good response");
  });

  it("throws string error when error field is a string", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: "Rate limit exceeded" }));

    await expect(executeGeminiCLI("hello")).rejects.toThrow("Rate limit exceeded");
  });

  it("falls back to raw text when JSON.parse returns null", async () => {
    mockExecuteCommand.mockResolvedValueOnce("null");

    const result = await executeGeminiCLI("hello");

    expect(result).toBe("null");
  });

  it("falls back to raw text when parsed JSON is not an object", async () => {
    mockExecuteCommand.mockResolvedValueOnce("42");

    const result = await executeGeminiCLI("hello");

    expect(result).toBe("42");
  });

  it("extracts JSON when warning prefix contains braces", async () => {
    const json = JSON.stringify({ response: "real response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`[Debug] config: { "retry": true }\n${json}`);

    const result = await executeGeminiCLI("hello");

    expect(result).toContain("real response");
  });

  it("throws array error with stringified details", async () => {
    const errors = [{ message: "Rate limited" }, { message: "Quota exceeded" }];
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: errors }));

    await expect(executeGeminiCLI("hello")).rejects.toThrow(
      'Gemini error: [{"message":"Rate limited"},{"message":"Quota exceeded"}]',
    );
  });
});
