import { createHash } from "node:crypto";
import { Logger } from "./logger.js";

interface CacheEntry {
  response: string;
  createdAt: number;
  lastAccessedAt: number;
  sizeBytes: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 100;

export interface ResponseCacheOptions {
  ttlMs?: number;
  maxSizeBytes?: number;
  maxEntries?: number;
}

export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxSizeBytes: number;
  private readonly maxEntries: number;
  private totalSizeBytes = 0;

  constructor(options?: ResponseCacheOptions) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  }

  static buildKey(provider: string, prompt: string, model?: string): string {
    const raw = `${provider}:${model ?? "default"}:${prompt}`;
    return createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.delete(key);
      Logger.debug(`Response cache expired: ${key}`);
      return null;
    }

    entry.lastAccessedAt = Date.now();
    return entry.response;
  }

  set(key: string, response: string): void {
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const sizeBytes = Buffer.byteLength(response, "utf-8");

    while (this.totalSizeBytes + sizeBytes > this.maxSizeBytes || this.cache.size >= this.maxEntries) {
      const lruKey = this.findLRU();
      if (!lruKey) break;
      this.delete(lruKey);
    }

    if (sizeBytes > this.maxSizeBytes) {
      Logger.debug(`Response too large to cache: ${sizeBytes} bytes`);
      return;
    }

    this.cache.set(key, {
      response,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      sizeBytes,
    });
    this.totalSizeBytes += sizeBytes;
    Logger.debug(
      `Response cached: ${key} (${sizeBytes} bytes, ${this.cache.size} entries, ${this.totalSizeBytes} total bytes)`,
    );
  }

  get size(): number {
    return this.cache.size;
  }

  get byteSize(): number {
    return this.totalSizeBytes;
  }

  clear(): void {
    this.cache.clear();
    this.totalSizeBytes = 0;
  }

  private delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSizeBytes -= entry.sizeBytes;
      this.cache.delete(key);
    }
  }

  private findLRU(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    return oldestKey;
  }
}

export const responseCache = new ResponseCache();
