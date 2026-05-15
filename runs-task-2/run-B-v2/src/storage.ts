import { readFile, writeFile, rename } from "node:fs/promises";
import { type ShortLink, type ShortLinkStore, ShortLinkStoreSchema } from "./types.js";

const STORAGE_FILE = process.env.SHORTENER_FILE ?? "shortener.json";

// codex-pair feedback (run-B-v2 task-2 HIGH×3 across storage.ts, codes.ts,
// routes.ts): every mutating operation does read-modify-write of the whole
// store, AND code-uniqueness check is TOCTOU vs save. Single-process async
// mutex serializes ALL mutations including the generate-and-insert flow used
// by createWithUniqueCode below.
let mutationQueue: Promise<unknown> = Promise.resolve();
function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(fn, fn);
  mutationQueue = next.catch(() => undefined);
  return next;
}

async function readAll(): Promise<ShortLinkStore> {
  // codex-pair feedback (run-B-v2 task-2 MED): existsSync + readFile is
  // TOCTOU. Read directly and handle ENOENT.
  let raw: string;
  try {
    raw = await readFile(STORAGE_FILE, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  }
  // codex-pair feedback (run-B-v2 task-2 MED): unvalidated JSON.parse can
  // crash request paths or flow malformed data through the API. Validate the
  // shape with Zod and fail explicitly on corruption.
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Corrupt ${STORAGE_FILE}: invalid JSON: ${(err as Error).message}`);
  }
  const validated = ShortLinkStoreSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(`Corrupt ${STORAGE_FILE}: ${validated.error.message}`);
  }
  return validated.data;
}

async function writeAll(store: ShortLinkStore): Promise<void> {
  // codex-pair feedback (run-B-v2 task-2 MED): non-atomic writes can leave the
  // file truncated mid-write. Write to a temp sibling + rename — atomic on
  // POSIX, observers see either old or new file but never partial.
  const tmp = `${STORAGE_FILE}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await rename(tmp, STORAGE_FILE);
}

export async function findByCode(code: string): Promise<ShortLink | null> {
  const store = await readAll();
  return store[code] ?? null;
}

// codex-pair feedback (run-B-v2 task-2 HIGH): saveLink + generateUniqueCode
// had a TOCTOU between code-existence check and write. Replaced with this
// atomic-insert primitive: generator runs inside the same lock that writes,
// so collision retry doesn't race against another insert.
export async function createWithUniqueCode(
  url: string,
  generateCode: () => string,
  maxAttempts: number,
): Promise<ShortLink> {
  return withMutationLock(async () => {
    const store = await readAll();
    let attempt = 0;
    while (attempt < maxAttempts) {
      const code = generateCode();
      if (!(code in store)) {
        const link: ShortLink = {
          code,
          url,
          visits: 0,
          createdAt: new Date().toISOString(),
        };
        store[code] = link;
        await writeAll(store);
        return link;
      }
      attempt += 1;
    }
    // codex-pair feedback (run-B-v2 task-2 HIGH/MED): unbounded retry would
    // hang under code-space exhaustion. Throw a typed error the route can map
    // to 503 (service unavailable).
    throw new CodeAllocationError(`Could not allocate a unique code in ${maxAttempts} attempts`);
  });
}

export class CodeAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeAllocationError";
  }
}

export async function incrementVisits(code: string): Promise<ShortLink | null> {
  // codex-pair feedback (run-B-v2 task-2 HIGH): visit counter race on the hot
  // path — concurrent GETs lost counts. Serialize through the same lock as
  // mutations. Note: this couples read-traffic to write-traffic which is a
  // throughput tradeoff worth knowing about; a per-code lock or atomic
  // counter store would be the v3 refinement.
  return withMutationLock(async () => {
    const store = await readAll();
    const link = store[code];
    if (!link) return null;
    link.visits += 1;
    store[code] = link;
    await writeAll(store);
    return link;
  });
}
