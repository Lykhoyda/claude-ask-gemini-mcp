import { z } from "zod";

export interface ShortLink {
  code: string;
  url: string;
  visits: number;
  createdAt: string;
}

export const ShortenRequestSchema = z.object({
  url: z.string().url(),
});

export type ShortenRequest = z.infer<typeof ShortenRequestSchema>;
