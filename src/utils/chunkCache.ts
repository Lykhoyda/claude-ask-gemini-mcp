import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { EditChunk } from "./changeModeChunker.js";
import { Logger } from "./logger.js";

interface CacheEntry {
  chunks: EditChunk[];
  timestamp: number;
  promptHash: string;
}

const CACHE_DIR = path.join(os.tmpdir(), "gemini-mcp-chunks");
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE_FILES = 50;

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Caches chunks from a changeMode response
 * @param prompt The original prompt (used for hash generation)
 * @param chunks The parsed and chunked edits
 * @returns A short cache key for retrieval
 */
export function cacheChunks(prompt: string, chunks: EditChunk[]): string {
  ensureCacheDir();
  cleanExpiredFiles(); // Cleanup on each write

  // Generate deterministic cache key from prompt
  const promptHash = createHash("sha256").update(prompt).digest("hex");
  const cacheKey = promptHash.slice(0, 8);
  const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  // Store with metadata
  const cacheData: CacheEntry = {
    chunks,
    timestamp: Date.now(),
    promptHash,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(cacheData));
    Logger.debug(`Cached ${chunks.length} chunks to file: ${cacheKey}.json`);
  } catch (error) {
    Logger.error(`Failed to cache chunks: ${error}`);
  }
  enforceFileLimits();
  return cacheKey;
}

/**
 * Retrieves cached chunks if they exist and haven't expired
 * @param cacheKey The cache key returned from cacheChunks
 * @returns The cached chunks or null if expired/not found
 */
export function getChunks(cacheKey: string): EditChunk[] | null {
  const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data: unknown = JSON.parse(fileContent);

    if (
      typeof data !== "object" ||
      data === null ||
      !Array.isArray((data as CacheEntry).chunks) ||
      typeof (data as CacheEntry).timestamp !== "number"
    ) {
      Logger.debug(`Cache file for ${cacheKey} has invalid shape, deleting`);
      fs.unlinkSync(filePath);
      return null;
    }

    const entry = data as CacheEntry;

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      fs.unlinkSync(filePath);
      Logger.debug(`Cache expired for ${cacheKey}, deleted file`);
      return null;
    }

    Logger.debug(`Cache hit for ${cacheKey}, returning ${entry.chunks.length} chunks`);
    return entry.chunks;
  } catch (error) {
    Logger.debug(`Cache read error for ${cacheKey}: ${error}`);
    try {
      fs.unlinkSync(filePath); // Clean up bad file
    } catch {}
    return null;
  }
}

function cleanExpiredFiles(): void {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(CACHE_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > CACHE_TTL) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (error) {
        // Individual file error - continue with others
        Logger.debug(`Error checking file ${file}: ${error}`);
      }
    }

    if (cleaned > 0) {
      Logger.debug(`Cleaned ${cleaned} expired cache files`);
    }
  } catch (error) {
    // Non-critical, just log
    Logger.debug(`Cache cleanup error: ${error}`);
  }
}

function enforceFileLimits(): void {
  try {
    const files = fs
      .readdirSync(CACHE_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(CACHE_DIR, f),
        mtime: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => a.mtime - b.mtime); // Oldest first

    // Remove oldest files if over limit
    if (files.length > MAX_CACHE_FILES) {
      const toRemove = files.slice(0, files.length - MAX_CACHE_FILES);
      for (const file of toRemove) {
        try {
          fs.unlinkSync(file.path);
        } catch {}
      }
      Logger.debug(`Removed ${toRemove.length} old cache files to enforce limit`);
    }
  } catch (error) {
    Logger.debug(`Error enforcing file limits: ${error}`);
  }
}
