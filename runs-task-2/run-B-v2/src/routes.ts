import { Router, type Request, type Response } from "express";
import { ShortenRequestSchema } from "./types.js";
import { findByCode, incrementVisits, createWithUniqueCode, CodeAllocationError } from "./storage.js";
import { generateCode, MAX_CODE_ALLOCATION_ATTEMPTS } from "./codes.js";
import { rateLimit } from "./rate-limit.js";

// codex-pair feedback (run-B-v2 task-2 HIGH): Express 5 widens req.params to
// `string | string[]`. Narrow the params type at the handler signature so
// `tsc --noEmit` passes without any casts at call sites.
type CodeParams = { code: string };

export const router = Router();

router.post("/shorten", rateLimit, async (req: Request, res: Response) => {
  const parsed = ShortenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  try {
    // codex-pair feedback (run-B-v2 task-2 HIGH×2): the previous generate-
    // then-save flow was a TOCTOU race AND had unbounded retry. Atomic
    // generate-and-insert under the storage mutex with bounded retries.
    const link = await createWithUniqueCode(parsed.data.url, generateCode, MAX_CODE_ALLOCATION_ATTEMPTS);
    const host = req.get("host") ?? "localhost";
    const proto = req.protocol;
    res.status(201).json({ code: link.code, shortUrl: `${proto}://${host}/${link.code}` });
  } catch (err) {
    if (err instanceof CodeAllocationError) {
      // codex-pair feedback (run-B-v2 task-2 MED): controlled failure instead
      // of hung request when code space is saturated.
      return res.status(503).json({ error: "Service temporarily unable to allocate a short code" });
    }
    throw err;
  }
});

router.get("/:code/stats", async (req: Request<CodeParams>, res: Response) => {
  const link = await findByCode(req.params.code);
  if (!link) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(link);
});

router.get("/:code", async (req: Request<CodeParams>, res: Response) => {
  const link = await incrementVisits(req.params.code);
  if (!link) {
    return res.status(404).json({ error: "Not found" });
  }
  res.redirect(302, link.url);
});
