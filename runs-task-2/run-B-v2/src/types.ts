import { z } from "zod";

// codex-pair feedback (run-B-v2 task-2 HIGH): use a Zod schema (not just a TS
// interface) so persisted JSON can be validated on read.
export const ShortLinkSchema = z.object({
  code: z.string(),
  url: z.string(),
  visits: z.number(),
  createdAt: z.string(),
});

export const ShortLinkStoreSchema = z.record(z.string(), ShortLinkSchema);
export type ShortLink = z.infer<typeof ShortLinkSchema>;
export type ShortLinkStore = z.infer<typeof ShortLinkStoreSchema>;

// codex-pair feedback (run-B-v2 task-2 HIGH): `z.string().url()` accepts
// dangerous schemes like `javascript:`, `data:`, `file:` — a malicious short
// URL would redirect visitors to arbitrary scheme handlers (XSS, exfiltration).
// Restrict to http/https via a refinement that re-parses with the URL API.
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export const ShortenRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (raw) => {
        try {
          const u = new URL(raw);
          return ALLOWED_PROTOCOLS.has(u.protocol);
        } catch {
          return false;
        }
      },
      { message: "URL must use http or https scheme" },
    ),
});

export type ShortenRequest = z.infer<typeof ShortenRequestSchema>;
