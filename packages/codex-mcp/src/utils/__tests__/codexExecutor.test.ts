import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLI, MODELS } from "../../constants.js";

vi.mock("@ask-llm/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ask-llm/shared")>();
  return {
    ...actual,
    executeCommand: vi.fn(),
    Logger: {
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { executeCommand, responseCache } from "@ask-llm/shared";
import { executeCodexCLI } from "../codexExecutor.js";

const mockExecuteCommand = vi.mocked(executeCommand);

beforeEach(() => {
  vi.clearAllMocks();
  responseCache.clear();
  mockExecuteCommand.mockResolvedValue("Codex response");
});

describe("executeCodexCLI argument construction", () => {
  it("uses 'exec' subcommand with correct flags", async () => {
    await executeCodexCLI({ prompt: "explain this code" });

    expect(mockExecuteCommand).toHaveBeenCalledOnce();
    const [cmd, args] = mockExecuteCommand.mock.calls[0];
    expect(cmd).toBe(CLI.COMMANDS.CODEX);
    expect(args[0]).toBe(CLI.COMMANDS.EXEC);
  });

  it("builds args with required flags and prompt as last positional", async () => {
    await executeCodexCLI({ prompt: "hello" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toEqual([
      CLI.COMMANDS.EXEC,
      CLI.FLAGS.SKIP_GIT,
      CLI.FLAGS.EPHEMERAL,
      CLI.FLAGS.JSON,
      CLI.FLAGS.MODEL,
      MODELS.DEFAULT,
      "hello",
    ]);
  });

  it("uses custom model when specified", async () => {
    await executeCodexCLI({ prompt: "hello", model: "o3" });

    const [, args] = mockExecuteCommand.mock.calls[0];
    expect(args).toContain("o3");
    expect(args).not.toContain(MODELS.DEFAULT);
  });

  it("passes onProgress callback to executeCommand", async () => {
    const onProgress = vi.fn();
    await executeCodexCLI({ prompt: "hello", onProgress });

    expect(mockExecuteCommand).toHaveBeenCalledWith(CLI.COMMANDS.CODEX, expect.any(Array), onProgress);
  });
});

describe("JSONL output parsing", () => {
  it("extracts agent_message text from item.completed event", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"thread.started","thread_id":"abc-123"}',
        '{"type":"turn.started"}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"The code looks good."}}',
        '{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":50}}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "review this" });
    expect(result.response).toContain("The code looks good.");
    expect(result.threadId).toBe("abc-123");
  });

  it("selects the LAST agent_message when multiple present", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"item.completed","item":{"type":"agent_message","text":"First message"}}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"Final answer"}}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "review this" });
    expect(result.response).toContain("Final answer");
    expect(result.response).not.toContain("First message");
  });

  it("skips non-agent_message item types", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"item.completed","item":{"type":"command_execution","command":"ls"}}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"Here are the files."}}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "list files" });
    expect(result.response).toContain("Here are the files.");
  });

  it("skips malformed JSON lines gracefully", async () => {
    mockExecuteCommand.mockResolvedValue(
      ["not json at all", '{"type":"item.completed","item":{"type":"agent_message","text":"Valid response"}}'].join(
        "\n",
      ),
    );

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toContain("Valid response");
  });

  it("falls back to raw text when no agent_message found", async () => {
    mockExecuteCommand.mockResolvedValue("Plain text output with no JSON");

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toBe("Plain text output with no JSON");
  });

  it("includes token stats from turn.completed in response", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"item.completed","item":{"type":"agent_message","text":"Analysis complete."}}',
        '{"type":"turn.completed","usage":{"input_tokens":5000,"output_tokens":200,"cached_input_tokens":4500}}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "analyze" });
    expect(result.response).toContain("5,000 input tokens");
    expect(result.response).toContain("200 output tokens");
    expect(result.response).toContain("4,500 cached");
  });

  it("extracts thread_id from thread.started event", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"thread.started","thread_id":"thread-uuid-456"}',
        '{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.threadId).toBe("thread-uuid-456");
  });

  it("throws on error events when no agent_message present", async () => {
    mockExecuteCommand.mockResolvedValue('{"type":"error","message":"Something went wrong"}');

    await expect(executeCodexCLI({ prompt: "test" })).rejects.toThrow("Codex error event");
  });

  it("returns agent_message even when error event is also present", async () => {
    mockExecuteCommand.mockResolvedValue(
      [
        '{"type":"item.completed","item":{"type":"agent_message","text":"Partial answer before error"}}',
        '{"type":"error","message":"Non-fatal tool error"}',
      ].join("\n"),
    );

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toContain("Partial answer before error");
  });
});

describe("quota fallback", () => {
  it("retries with fallback model on rate_limit_exceeded error", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("rate_limit_exceeded"))
      .mockResolvedValueOnce('{"type":"item.completed","item":{"type":"agent_message","text":"Fallback response"}}');

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toContain("Fallback response");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);

    const [, fallbackArgs] = mockExecuteCommand.mock.calls[1];
    expect(fallbackArgs).toContain(MODELS.FALLBACK);
  });

  it("retries with fallback model on 429 error", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockResolvedValueOnce('{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}');

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toContain("OK");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
  });

  it("retries with fallback model on insufficient_quota error", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("insufficient_quota"))
      .mockResolvedValueOnce('{"type":"item.completed","item":{"type":"agent_message","text":"OK"}}');

    const result = await executeCodexCLI({ prompt: "test" });
    expect(result.response).toContain("OK");
  });

  it("does not retry if already using fallback model", async () => {
    mockExecuteCommand.mockRejectedValueOnce(new Error("rate_limit_exceeded"));

    await expect(executeCodexCLI({ prompt: "test", model: MODELS.FALLBACK })).rejects.toThrow("rate_limit_exceeded");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
  });

  it("throws combined error when both models fail", async () => {
    mockExecuteCommand
      .mockRejectedValueOnce(new Error("rate_limit_exceeded"))
      .mockRejectedValueOnce(new Error("still failing"));

    await expect(executeCodexCLI({ prompt: "test" })).rejects.toThrow(
      `${MODELS.DEFAULT} quota exceeded, ${MODELS.FALLBACK} fallback also failed: still failing`,
    );
  });

  it("re-throws non-quota errors without retry", async () => {
    mockExecuteCommand.mockRejectedValueOnce(new Error("ENOENT: codex not found"));

    await expect(executeCodexCLI({ prompt: "test" })).rejects.toThrow("ENOENT: codex not found");
    expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
  });
});
