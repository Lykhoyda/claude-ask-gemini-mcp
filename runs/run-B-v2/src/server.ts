import express from "express";
import { todosRouter } from "./routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/todos", todosRouter);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
