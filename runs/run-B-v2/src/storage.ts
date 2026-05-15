import { readFile, writeFile, rename } from "node:fs/promises";
import { type Todo, TodoArraySchema } from "./types.js";

const STORAGE_FILE = process.env.TODOS_FILE ?? "todos.json";

// codex-pair feedback (run-B-v2 HIGH): unsynchronized read-modify-write loses
// updates under concurrent requests. Serialize ALL mutations through a single-
// process async queue. Each mutation appends to the chain and awaits its turn
// before reading/writing. Read-only `listTodos` doesn't need the lock since
// reads don't conflict with each other.
let mutationQueue: Promise<unknown> = Promise.resolve();
function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(fn, fn);
  // Swallow errors on the chain so a failed mutation doesn't poison the queue
  mutationQueue = next.catch(() => undefined);
  return next;
}

async function readAll(): Promise<Todo[]> {
  // codex-pair feedback (run-B-v2 MED): existsSync + readFile is TOCTOU.
  // Attempt readFile directly and treat ENOENT as "no todos yet."
  let raw: string;
  try {
    raw = await readFile(STORAGE_FILE, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  // codex-pair feedback (run-B-v2 HIGH): validate persisted JSON via Zod
  // rather than `as Todo[]` — disk corruption or schema drift would otherwise
  // flow through the API as "valid" todos.
  const parsed = TodoArraySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Corrupt todos.json: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function writeAll(todos: Todo[]): Promise<void> {
  // codex-pair feedback (run-B-v2 MED): writeFile to the target path is non-
  // atomic — a crash mid-write leaves a truncated file that crashes readAll
  // on next request. Write to a sibling temp then rename: atomic on POSIX,
  // observers always see either the old file or the new one.
  const tmp = `${STORAGE_FILE}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(todos, null, 2), "utf-8");
  await rename(tmp, STORAGE_FILE);
}

export async function listTodos(): Promise<Todo[]> {
  return readAll();
}

export async function createTodo(text: string): Promise<Todo> {
  return withMutationLock(async () => {
    const todos = await readAll();
    const todo: Todo = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: new Date().toISOString(),
    };
    todos.push(todo);
    await writeAll(todos);
    return todo;
  });
}

export async function updateTodo(id: string, done: boolean): Promise<Todo | null> {
  return withMutationLock(async () => {
    const todos = await readAll();
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      return null;
    }
    todos[idx].done = done;
    await writeAll(todos);
    return todos[idx];
  });
}

export async function deleteTodo(id: string): Promise<boolean> {
  return withMutationLock(async () => {
    const todos = await readAll();
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) {
      return false;
    }
    todos.splice(idx, 1);
    await writeAll(todos);
    return true;
  });
}
