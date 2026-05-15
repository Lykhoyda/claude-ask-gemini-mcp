import { Router, type Request, type Response } from "express";
import { ShortenRequestSchema, type ShortLink } from "./types.js";
import { findByCode, saveLink, incrementVisits } from "./storage.js";
import { generateUniqueCode } from "./codes.js";
import { rateLimit } from "./rate-limit.js";

export const router = Router();

router.post("/shorten", rateLimit, async (req: Request, res: Response) => {
  const parsed = ShortenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const code = await generateUniqueCode();
  const link: ShortLink = {
    code,
    url: parsed.data.url,
    visits: 0,
    createdAt: new Date().toISOString(),
  };
  await saveLink(link);
  const host = req.get("host") ?? "localhost";
  const proto = req.protocol;
  res.status(201).json({ code, shortUrl: `${proto}://${host}/${code}` });
});

router.get("/:code/stats", async (req: Request, res: Response) => {
  const link = await findByCode(req.params.code);
  if (!link) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(link);
});

router.get("/:code", async (req: Request, res: Response) => {
  const link = await incrementVisits(req.params.code);
  if (!link) {
    return res.status(404).json({ error: "Not found" });
  }
  res.redirect(302, link.url);
});
