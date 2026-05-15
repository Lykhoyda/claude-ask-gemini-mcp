import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ShortLink } from "./types.js";

const STORAGE_FILE = process.env.SHORTENER_FILE ?? "shortener.json";

type Store = Record<string, ShortLink>;

async function readAll(): Promise<Store> {
  if (!existsSync(STORAGE_FILE)) {
    return {};
  }
  const raw = await readFile(STORAGE_FILE, "utf-8");
  return JSON.parse(raw) as Store;
}

async function writeAll(store: Store): Promise<void> {
  await writeFile(STORAGE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function findByCode(code: string): Promise<ShortLink | null> {
  const store = await readAll();
  return store[code] ?? null;
}

export async function codeExists(code: string): Promise<boolean> {
  const store = await readAll();
  return code in store;
}

export async function saveLink(link: ShortLink): Promise<void> {
  const store = await readAll();
  store[link.code] = link;
  await writeAll(store);
}

export async function incrementVisits(code: string): Promise<ShortLink | null> {
  const store = await readAll();
  const link = store[code];
  if (!link) return null;
  link.visits += 1;
  store[code] = link;
  await writeAll(store);
  return link;
}
