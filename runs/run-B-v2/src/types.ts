import { z } from "zod";

// codex-pair feedback (run-B-v2 HIGH): use a Zod schema (not just a TS
// interface) to validate persisted JSON on read. Type-asserting parsed
// disk contents with `as Todo[]` is unsafe — disk corruption or schema
// drift can flow through the API.
export const TodoSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  createdAt: z.string(),
});

export const TodoArraySchema = z.array(TodoSchema);
export type Todo = z.infer<typeof TodoSchema>;

export const CreateTodoSchema = z.object({
  text: z.string().min(1).max(500),
});

export const UpdateTodoSchema = z.object({
  done: z.boolean(),
});

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
