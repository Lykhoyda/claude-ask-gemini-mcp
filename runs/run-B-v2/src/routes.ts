import { Router, type Request, type Response } from "express";
import { CreateTodoSchema, UpdateTodoSchema } from "./types.js";
import { listTodos, createTodo, updateTodo, deleteTodo } from "./storage.js";

// codex-pair feedback (run-B-v2 HIGH): Express 5 widens req.params to
// `string | string[]`; declaring the params shape explicitly narrows the
// type so tsc --noEmit passes.
type IdParams = { id: string };

export const todosRouter = Router();

todosRouter.get("/", async (_req: Request, res: Response) => {
  const todos = await listTodos();
  res.json(todos);
});

todosRouter.post("/", async (req: Request, res: Response) => {
  const parsed = CreateTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const todo = await createTodo(parsed.data.text);
  res.status(201).json(todo);
});

todosRouter.patch("/:id", async (req: Request<IdParams>, res: Response) => {
  const parsed = UpdateTodoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const updated = await updateTodo(req.params.id, parsed.data.done);
  if (!updated) {
    return res.status(404).json({ error: "Todo not found" });
  }
  res.json(updated);
});

todosRouter.delete("/:id", async (req: Request<IdParams>, res: Response) => {
  const deleted = await deleteTodo(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Todo not found" });
  }
  res.status(204).send();
});
