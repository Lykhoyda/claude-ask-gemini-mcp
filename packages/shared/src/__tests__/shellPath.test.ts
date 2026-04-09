import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let resolveShellPath: typeof import("../shellPath.js").resolveShellPath;
let getSpawnEnv: typeof import("../shellPath.js").getSpawnEnv;

describe("shellPath", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../shellPath.js");
    resolveShellPath = mod.resolveShellPath;
    getSpawnEnv = mod.getSpawnEnv;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a non-empty PATH string", () => {
    const path = resolveShellPath();
    expect(path).toBeTruthy();
    expect(typeof path).toBe("string");
  });

  it("caches the result on subsequent calls", () => {
    const first = resolveShellPath();
    const second = resolveShellPath();
    expect(first).toBe(second);
  });

  it("respects ASK_LLM_PATH env var override", async () => {
    vi.stubEnv("ASK_LLM_PATH", "/custom/path:/another/path");
    vi.resetModules();
    const mod = await import("../shellPath.js");
    expect(mod.resolveShellPath()).toBe("/custom/path:/another/path");
  });

  it("getSpawnEnv returns env with PATH set", () => {
    const env = getSpawnEnv();
    expect(env.PATH).toBeTruthy();
    expect(env.HOME).toBe(process.env.HOME);
  });
});
