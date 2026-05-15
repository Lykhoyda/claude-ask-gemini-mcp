import express from "express";
import { router } from "./routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  // codex-pair feedback (run-B-v2 task-2 HIGH): `trust proxy: true` trusts
  // ANY X-Forwarded-For value, letting any client spoof their IP and bypass
  // the per-IP rate limit. Only trust proxies declared via TRUST_PROXY env;
  // default to false so direct deployments don't accidentally read attacker-
  // controlled headers. Operators behind a known proxy chain set
  // TRUST_PROXY="1" (one hop) or a CIDR list per Express docs.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    // Allow numeric (hop count) or string (CIDR list / "loopback") values.
    const numeric = Number.parseInt(trustProxy, 10);
    app.set("trust proxy", Number.isFinite(numeric) && String(numeric) === trustProxy ? numeric : trustProxy);
  } else {
    app.set("trust proxy", false);
  }
  app.use(router);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
