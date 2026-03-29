import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResponseCache } from "../responseCache.js";

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ ttlMs: 1000, maxSizeBytes: 1024, maxEntries: 5 });
  });

  afterEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  it("stores and retrieves a response", () => {
    cache.set("key1", "hello world");
    expect(cache.get("key1")).toBe("hello world");
  });

  it("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "hello");
    vi.advanceTimersByTime(1500);
    expect(cache.get("key1")).toBeNull();
  });

  it("evicts LRU entry when max entries reached", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(10);
      cache.set(`key${i}`, `value${i}`);
    }
    expect(cache.size).toBe(5);

    vi.advanceTimersByTime(10);
    cache.get("key0");

    vi.advanceTimersByTime(10);
    cache.set("key5", "value5");

    expect(cache.size).toBe(5);
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key0")).toBe("value0");
    expect(cache.get("key5")).toBe("value5");
  });

  it("evicts entries when max size exceeded", () => {
    const bigValue = "x".repeat(512);
    cache.set("big1", bigValue);
    cache.set("big2", bigValue);
    expect(cache.size).toBe(2);

    cache.set("big3", bigValue);
    expect(cache.size).toBe(2);
    expect(cache.get("big1")).toBeNull();
  });

  it("rejects single entries larger than maxSizeBytes", () => {
    const huge = "x".repeat(2048);
    cache.set("huge", huge);
    expect(cache.size).toBe(0);
  });

  it("updates existing entries on re-set", () => {
    cache.set("key1", "old");
    cache.set("key1", "new");
    expect(cache.get("key1")).toBe("new");
    expect(cache.size).toBe(1);
  });

  it("tracks total byte size correctly", () => {
    cache.set("a", "hello");
    const sizeAfterFirst = cache.byteSize;
    expect(sizeAfterFirst).toBe(Buffer.byteLength("hello", "utf-8"));

    cache.set("b", "world");
    expect(cache.byteSize).toBe(sizeAfterFirst + Buffer.byteLength("world", "utf-8"));

    cache.clear();
    expect(cache.byteSize).toBe(0);
  });

  describe("buildKey", () => {
    it("produces different keys for different providers", () => {
      const k1 = ResponseCache.buildKey("gemini", "hello", "model-a");
      const k2 = ResponseCache.buildKey("codex", "hello", "model-a");
      expect(k1).not.toBe(k2);
    });

    it("produces different keys for different models", () => {
      const k1 = ResponseCache.buildKey("gemini", "hello", "pro");
      const k2 = ResponseCache.buildKey("gemini", "hello", "flash");
      expect(k1).not.toBe(k2);
    });

    it("produces same key for same inputs", () => {
      const k1 = ResponseCache.buildKey("gemini", "hello");
      const k2 = ResponseCache.buildKey("gemini", "hello");
      expect(k1).toBe(k2);
    });
  });
});
