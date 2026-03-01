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
    await executeGeminiCLI({ prompt: "explain this code" });

    expect(mockExecuteCommand).toHaveBeenCalledOnce();
    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("-p");
    expect(args).not.toContain("--");
  });

  it("passes prompt immediately after -p flag", async () => {
    await executeGeminiCLI({ prompt: "explain this code" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const flagIndex = args.indexOf("-p");
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(args[flagIndex + 1]).toBe("explain this code");
  });

  it("builds basic args with only prompt", async () => {
    await executeGeminiCLI({ prompt: "hello" });

    const [cmd, args] = mockExecuteCommand.mock.calls[0];
    expect(cmd).toBe(CLI.COMMANDS.GEMINI);
    expect(args).toEqual([CLI.FLAGS.OUTPUT_FORMAT, CLI.OUTPUT_FORMATS.JSON, CLI.FLAGS.PROMPT, "hello"]);
  });

  it("includes -m flag when model is specified", async () => {
    await executeGeminiCLI({ prompt: "hello", model: "gemini-3-flash-preview" });

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
    await executeGeminiCLI({ prompt: "hello", sandbox: true });

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
    await executeGeminiCLI({ prompt: "hello", model: "gemini-3-flash-preview", sandbox: true });

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

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("Flash response");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
  });

  it("uses -p flag in fallback args too", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI({ prompt: "hello" });

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

    await executeGeminiCLI({ prompt: "hello", sandbox: true });

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

    await expect(executeGeminiCLI({ prompt: "hello", model: MODELS.FLASH })).rejects.toThrow("RESOURCE_EXHAUSTED");
    expect(mockExecuteCommand).toHaveBeenCalledOnce();
  });

  it("throws combined error when fallback also fails", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockRejectedValueOnce(new Error("Flash also failed"));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow(
      `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: Flash also failed`,
    );
  });

  it("re-throws non-quota errors without fallback", async () => {
    mockExecuteCommand.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow("Connection refused");
    expect(mockExecuteCommand).toHaveBeenCalledOnce();
  });
});

describe("executeGeminiCLI changeMode", () => {
  it("replaces file: syntax with @ syntax in changeMode", async () => {
    await executeGeminiCLI({ prompt: "fix file:src/index.ts and file:src/app.ts", changeMode: true });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const promptArg = args[args.indexOf(CLI.FLAGS.PROMPT) + 1];
    expect(promptArg).toContain("@src/index.ts");
    expect(promptArg).toContain("@src/app.ts");
    expect(promptArg).not.toContain("file:src/index.ts");
  });

  it("wraps prompt in changeMode instructions", async () => {
    await executeGeminiCLI({ prompt: "fix the bug", changeMode: true });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const promptArg = args[args.indexOf(CLI.FLAGS.PROMPT) + 1];
    expect(promptArg).toContain("[CHANGEMODE INSTRUCTIONS]");
    expect(promptArg).toContain("OLD:");
    expect(promptArg).toContain("NEW:");
    expect(promptArg).toContain("fix the bug");
  });

  it("still uses -p flag with changeMode enabled", async () => {
    await executeGeminiCLI({ prompt: "fix the bug", changeMode: true });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("-p");
    expect(args).not.toContain("--");
  });
});

describe("executeGeminiCLI JSON output format", () => {
  it("always passes --output-format json flag", async () => {
    await executeGeminiCLI({ prompt: "hello" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("--output-format");
    expect(args).toContain("json");
  });

  it("passes --output-format json before -p flag", async () => {
    await executeGeminiCLI({ prompt: "hello" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const formatIndex = args.indexOf("--output-format");
    const promptIndex = args.indexOf("-p");
    expect(formatIndex).toBeLessThan(promptIndex);
  });

  it("includes --output-format json in fallback args", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI({ prompt: "hello" });

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toContain("--output-format");
    expect(fallbackArgs).toContain("json");
  });

  it("parses JSON response and extracts response text", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "parsed text", stats: {} }));

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("parsed text");
  });

  it("appends stats summary when stats are present", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({
        response: "some response",
        stats: {
          models: {
            "gemini-3.1-pro-preview": {
              tokens: { input: 1234, candidates: 567, cached: 0, thoughts: 26 },
            },
          },
        },
      }),
    );

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("[Gemini stats:");
    expect(result.response).toContain("1,234 input tokens");
    expect(result.response).toContain("567 output tokens");
    expect(result.response).toContain("gemini-3.1-pro-preview");
  });

  it("falls back to raw text when output is not valid JSON", async () => {
    mockExecuteCommand.mockResolvedValueOnce("plain text response");

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toBe("plain text response");
  });

  it("falls back to raw text when JSON has no response field", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ stats: {} }));

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toBe(JSON.stringify({ stats: {} }));
  });

  it("throws when JSON contains an error field", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: { message: "Rate limit exceeded", code: 429 } }));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow("Rate limit exceeded");
  });

  it("throws with code when error has no message", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: { code: 503 } }));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow("Gemini error code 503");
  });

  it("extracts JSON when CLI prints warnings before JSON object", async () => {
    const json = JSON.stringify({ response: "actual response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`WARNING: something\n${json}`);

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("actual response");
  });

  it("falls back to raw text when output has no JSON object at all", async () => {
    mockExecuteCommand.mockResolvedValueOnce("no json here at all");

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toBe("no json here at all");
  });

  it("extracts JSON when CLI prints trailing text after JSON object", async () => {
    const json = JSON.stringify({ response: "good response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`${json}\nDone in 3.2s`);

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("good response");
  });

  it("throws string error when error field is a string", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: "Rate limit exceeded" }));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow("Rate limit exceeded");
  });

  it("falls back to raw text when JSON.parse returns null", async () => {
    mockExecuteCommand.mockResolvedValueOnce("null");

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toBe("null");
  });

  it("falls back to raw text when parsed JSON is not an object", async () => {
    mockExecuteCommand.mockResolvedValueOnce("42");

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toBe("42");
  });

  it("extracts JSON when warning prefix contains braces", async () => {
    const json = JSON.stringify({ response: "real response", stats: {} });
    mockExecuteCommand.mockResolvedValueOnce(`[Debug] config: { "retry": true }\n${json}`);

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("real response");
  });

  it("throws array error with stringified details", async () => {
    const errors = [{ message: "Rate limited" }, { message: "Quota exceeded" }];
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ error: errors }));

    await expect(executeGeminiCLI({ prompt: "hello" })).rejects.toThrow(
      'Gemini error: [{"message":"Rate limited"},{"message":"Quota exceeded"}]',
    );
  });
});

describe("executeGeminiCLI session support", () => {
  it("includes --resume flag when sessionId is provided", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", sessionId: "bcc639e4-3415-4270-9fe9-260e6a15203a" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("--resume");
    expect(args).toContain("bcc639e4-3415-4270-9fe9-260e6a15203a");
  });

  it("places --resume before --output-format in args", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", sessionId: "test-session" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const resumeIndex = args.indexOf("--resume");
    const formatIndex = args.indexOf("--output-format");
    expect(resumeIndex).toBeGreaterThanOrEqual(0);
    expect(resumeIndex).toBeLessThan(formatIndex);
  });

  it("does not include --resume when sessionId is undefined", async () => {
    await executeGeminiCLI({ prompt: "hello" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).not.toContain("--resume");
  });

  it("preserves --resume in fallback args on quota error", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "Flash response" }));

    await executeGeminiCLI({ prompt: "hello", sessionId: "my-session" });

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toContain("--resume");
    expect(fallbackArgs).toContain("my-session");
  });

  it("returns session_id from JSON response", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({ session_id: "bcc639e4-3415-4270-9fe9-260e6a15203a", response: "some answer" }),
    );

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.sessionId).toBe("bcc639e4-3415-4270-9fe9-260e6a15203a");
  });

  it("returns undefined sessionId when session_id absent from JSON", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "no session" }));

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.sessionId).toBeUndefined();
  });

  it("returns undefined sessionId for raw text fallback", async () => {
    mockExecuteCommand.mockResolvedValueOnce("plain text");

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.sessionId).toBeUndefined();
  });

  it("builds correct full args with model, sandbox, and sessionId", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({
      prompt: "hello",
      model: "gemini-3-flash-preview",
      sandbox: true,
      sessionId: "abc-123",
    });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.FLAGS.MODEL,
      "gemini-3-flash-preview",
      CLI.FLAGS.SANDBOX,
      CLI.FLAGS.RESUME,
      "abc-123",
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });
});

describe("executeGeminiCLI stats format (real CLI shape)", () => {
  it("extracts token counts from stats.models structure", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({
        response: "answer",
        stats: {
          models: {
            "gemini-3.1-pro-preview": {
              tokens: { input: 10891, candidates: 5, cached: 0, thoughts: 26 },
            },
          },
        },
      }),
    );

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("[Gemini stats:");
    expect(result.response).toContain("10,891 input tokens");
    expect(result.response).toContain("5 output tokens");
    expect(result.response).toContain("gemini-3.1-pro-preview");
  });

  it("includes cached token count when non-zero", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({
        response: "answer",
        stats: {
          models: {
            "gemini-3.1-pro-preview": {
              tokens: { input: 5000, candidates: 100, cached: 3000, thoughts: 10 },
            },
          },
        },
      }),
    );

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).toContain("3,000 cached");
  });

  it("omits cached count when zero", async () => {
    mockExecuteCommand.mockResolvedValueOnce(
      JSON.stringify({
        response: "answer",
        stats: {
          models: {
            "gemini-3.1-pro-preview": {
              tokens: { input: 5000, candidates: 100, cached: 0, thoughts: 10 },
            },
          },
        },
      }),
    );

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).not.toContain("cached");
  });

  it("returns empty stats footer when stats.models is missing", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "answer", stats: {} }));

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).not.toContain("[Gemini stats:");
  });

  it("returns empty stats footer when stats is undefined", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "answer" }));

    const result = await executeGeminiCLI({ prompt: "hello" });

    expect(result.response).not.toContain("[Gemini stats:");
  });
});

describe("executeGeminiCLI includeDirs support", () => {
  it("includes --include-directories flag for each dir with correct pairing", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", includeDirs: ["packages/api", "packages/shared"] });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const firstIdx = args.indexOf(CLI.FLAGS.INCLUDE_DIRECTORIES);
    expect(args[firstIdx + 1]).toBe("packages/api");
    const secondIdx = args.indexOf(CLI.FLAGS.INCLUDE_DIRECTORIES, firstIdx + 1);
    expect(args[secondIdx + 1]).toBe("packages/shared");
  });

  it("does not include --include-directories when empty array", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", includeDirs: [] });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).not.toContain(CLI.FLAGS.INCLUDE_DIRECTORIES);
  });

  it("places --include-directories before --output-format", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", includeDirs: ["packages/api"] });

    const [, args] = mockExecuteCommand.mock.calls[0];
    const includeIdx = args.indexOf(CLI.FLAGS.INCLUDE_DIRECTORIES);
    const outputFormatIdx = args.indexOf(CLI.FLAGS.OUTPUT_FORMAT);
    expect(includeIdx).toBeLessThan(outputFormatIdx);
  });

  it("does not include --include-directories when undefined", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).not.toContain(CLI.FLAGS.INCLUDE_DIRECTORIES);
  });

  it("preserves includeDirs in fallback args on quota exceeded", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED"))
      .mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({ prompt: "hello", includeDirs: ["packages/api"] });

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    const includeIdx = fallbackArgs.indexOf(CLI.FLAGS.INCLUDE_DIRECTORIES);
    expect(includeIdx).toBeGreaterThan(-1);
    expect(fallbackArgs[includeIdx + 1]).toBe("packages/api");
  });

  it("builds correct full args with model, sandbox, sessionId, and includeDirs", async () => {
    mockExecuteCommand.mockResolvedValueOnce(JSON.stringify({ response: "ok" }));

    await executeGeminiCLI({
      prompt: "hello",
      model: "gemini-3-flash-preview",
      sandbox: true,
      sessionId: "abc-123",
      includeDirs: ["packages/api"],
    });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.FLAGS.MODEL,
      "gemini-3-flash-preview",
      CLI.FLAGS.SANDBOX,
      CLI.FLAGS.RESUME,
      "abc-123",
      CLI.FLAGS.INCLUDE_DIRECTORIES,
      "packages/api",
      CLI.FLAGS.OUTPUT_FORMAT,
      CLI.OUTPUT_FORMATS.JSON,
      CLI.FLAGS.PROMPT,
      "hello",
    ]);
  });
});
