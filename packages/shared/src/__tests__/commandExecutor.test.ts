import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeCommand, quoteArgsForWindows, sanitizeErrorForLLM } from "../commandExecutor.js";

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

  it("returns first 3 lines for short unknown errors", () => {
    const result = sanitizeErrorForLLM("Some error\nCause: something broke\nAt module.ts:42", "gemini");
    expect(result).toContain("Some error");
    expect(result).toContain("Cause: something broke");
    expect(result).toContain("At module.ts:42");
  });

  it("passes through quota errors unmodified for downstream fallback", () => {
    const stderr = "Some prefix output\nRandom line\nRESOURCE_EXHAUSTED: quota exceeded for model";
    const result = sanitizeErrorForLLM(stderr, "gemini");
    expect(result).toContain("RESOURCE_EXHAUSTED");
  });

  it("passes through TerminalQuotaError for downstream fallback", () => {
    const stderr = "Error running model\nTerminalQuotaError: You have exhausted your capacity";
    const result = sanitizeErrorForLLM(stderr, "gemini");
    expect(result).toContain("TerminalQuotaError");
  });

  it("does not match ENOENT from CLI file errors", () => {
    const result = sanitizeErrorForLLM(
      "Error: ENOENT: no such file or directory, open '/missing/config.json'",
      "gemini",
    );
    expect(result).not.toContain("not found on PATH");
  });
});

describe("executeCommand stdin payload (issue #30)", () => {
  const ECHO_STDIN = ["-e", "process.stdin.pipe(process.stdout)"];
  // Real-spawn tests need a generous timeout: Node 22 startup + stdin pipe
  // setup on Ubuntu CI runners under load has been observed at 8-13s
  // (vitest default 5s causes false-positive timeouts). Locally these all
  // run in <100ms; the bump is purely defensive against runner contention.
  const SPAWN_TIMEOUT_MS = 30_000;

  it(
    "writes stdin payload to child before EOF",
    async () => {
      const result = await executeCommand("node", ECHO_STDIN, undefined, undefined, "hello from stdin");
      expect(result).toBe("hello from stdin");
    },
    SPAWN_TIMEOUT_MS,
  );

  it(
    "supports payloads above the 16 KiB ARG_MAX threshold",
    async () => {
      const payload = `${"x".repeat(20_000)}END`;
      const result = await executeCommand("node", ECHO_STDIN, undefined, undefined, payload);
      expect(result).toBe(payload);
      expect(result.length).toBe(20_003);
    },
    SPAWN_TIMEOUT_MS,
  );

  it(
    "preserves existing zero-stdin behavior when payload is undefined",
    async () => {
      const result = await executeCommand("node", ["-e", "console.log('hi')"]);
      expect(result).toBe("hi");
    },
    SPAWN_TIMEOUT_MS,
  );

  it(
    "treats empty-string stdin as no-op (still EOFs cleanly)",
    async () => {
      const result = await executeCommand("node", ["-e", "console.log('hi')"], undefined, undefined, "");
      expect(result).toBe("hi");
    },
    SPAWN_TIMEOUT_MS,
  );
});

describe("executeCommand env propagation to spawned children (issue #32)", () => {
  // Verifies the spawn-side end of the chain that ensureWorkspaceTrustEnv
  // (in geminiExecutor) relies on. Without this test, a future contributor
  // could refactor getSpawnEnv() in shellPath.ts and silently break
  // workspace-trust propagation — every existing trust-handling test mocks
  // executeCommand directly and never exercises the real spawn env merge.
  const PRINT_ENV = (varName: string) => ["-e", `console.log(process.env.${varName} || 'unset')`];

  let originalTrust: string | undefined;
  let originalCustom: string | undefined;

  beforeEach(() => {
    originalTrust = process.env.GEMINI_TRUST_WORKSPACE;
    originalCustom = process.env.ASK_LLM_TEST_CUSTOM;
    delete process.env.GEMINI_TRUST_WORKSPACE;
    delete process.env.ASK_LLM_TEST_CUSTOM;
  });

  afterEach(() => {
    if (originalTrust === undefined) delete process.env.GEMINI_TRUST_WORKSPACE;
    else process.env.GEMINI_TRUST_WORKSPACE = originalTrust;
    if (originalCustom === undefined) delete process.env.ASK_LLM_TEST_CUSTOM;
    else process.env.ASK_LLM_TEST_CUSTOM = originalCustom;
  });

  it("propagates GEMINI_TRUST_WORKSPACE=true from parent process.env to spawned child", async () => {
    process.env.GEMINI_TRUST_WORKSPACE = "true";

    const result = await executeCommand("node", PRINT_ENV("GEMINI_TRUST_WORKSPACE"));

    expect(result).toBe("true");
  });

  it("child sees 'unset' when parent env var is not set (verifies test isolation)", async () => {
    const result = await executeCommand("node", PRINT_ENV("GEMINI_TRUST_WORKSPACE"));

    expect(result).toBe("unset");
  });

  it("propagates arbitrary env vars set on parent process.env at spawn time", async () => {
    process.env.ASK_LLM_TEST_CUSTOM = "value-set-by-test";

    const result = await executeCommand("node", PRINT_ENV("ASK_LLM_TEST_CUSTOM"));

    expect(result).toBe("value-set-by-test");
  });
});
