import { describe, expect, it } from "vitest";
import { quoteArgsForWindows, sanitizeErrorForLLM } from "../commandExecutor.js";

describe("quoteArgsForWindows", () => {
  it("leaves simple args unchanged", () => {
    expect(quoteArgsForWindows(["-m", "gemini-3.1-pro-preview", "-p", "hello"])).toEqual([
      "-m",
      "gemini-3.1-pro-preview",
      "-p",
      "hello",
    ]);
  });

  it("quotes args containing spaces", () => {
    expect(quoteArgsForWindows(["-p", "What model are you?"])).toEqual(["-p", '"What model are you?"']);
  });

  it("escapes double quotes inside args", () => {
    expect(quoteArgsForWindows(['say "hello"'])).toEqual(['"say \\"hello\\""']);
  });

  it("quotes args containing shell metacharacters", () => {
    expect(quoteArgsForWindows(["foo & bar"])).toEqual(['"foo & bar"']);
    expect(quoteArgsForWindows(["a | b"])).toEqual(['"a | b"']);
    expect(quoteArgsForWindows(["a^b"])).toEqual(['"a^b"']);
  });

  it("handles empty args array", () => {
    expect(quoteArgsForWindows([])).toEqual([]);
  });

  it("preserves a full gemini CLI arg set with multi-word prompt", () => {
    const args = ["-m", "gemini-3.1-pro-preview", "--output-format", "json", "-p", "Review this code for bugs"];
    const quoted = quoteArgsForWindows(args);
    expect(quoted).toEqual([
      "-m",
      "gemini-3.1-pro-preview",
      "--output-format",
      "json",
      "-p",
      '"Review this code for bugs"',
    ]);
  });
});

describe("sanitizeErrorForLLM", () => {
  it("detects Node.js version mismatch from regex error", () => {
    const stderr = `file:///opt/homebrew/lib/chunk.js:45986
var zeroWidthClusterRegex = /regex/v;
SyntaxError: Invalid regular expression flags
    at ESMLoader.moduleStrategy
Node.js v18.15.0`;
    const result = sanitizeErrorForLLM(stderr, "gemini");
    expect(result).toContain("Node.js v20+");
    expect(result).toContain("v18.15.0");
    expect(result).not.toContain("ESMLoader");
  });

  it("detects command not found", () => {
    const result = sanitizeErrorForLLM("gemini: command not found", "gemini");
    expect(result).toContain("not found on PATH");
  });

  it("detects ENOENT spawn error", () => {
    const result = sanitizeErrorForLLM("spawn gemini ENOENT", "gemini");
    expect(result).toContain("not found on PATH");
  });

  it("detects permission denied", () => {
    const result = sanitizeErrorForLLM("EACCES: permission denied", "gemini");
    expect(result).toContain("Permission denied");
  });

  it("truncates long unknown errors", () => {
    const longError = "x".repeat(1000);
    const result = sanitizeErrorForLLM(longError, "gemini");
    expect(result.length).toBeLessThan(600);
    expect(result).toContain("truncated");
  });

  it("returns first line for short unknown errors", () => {
    const result = sanitizeErrorForLLM("Some error\nStack trace line 1\nLine 2", "gemini");
    expect(result).toBe("Some error");
  });
});
