import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

interface IpEntry {
  count: number;
  windowStart: number;
}

const ipMap = new Map<string, IpEntry>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    ipMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  entry.count += 1;
  next();
}
