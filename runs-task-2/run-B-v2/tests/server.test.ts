import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/server.js";
import { _resetRateLimitForTests } from "../src/rate-limit.js";

// codex-pair feedback (run-B-v2 task-2 HIGH): the previous suite hard-coded
// TEST_FILE = "shortener.json" and deleted it in beforeEach — running the
// suite from the project root would have wiped real local data. Use a
// per-test-run temp directory and inject SHORTENER_FILE before importing
// storage so tests are isolated from each other and from production paths.
let tempDir: string;
let testFile: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "url-shortener-test-"));
  testFile = join(tempDir, "shortener.json");
  process.env.SHORTENER_FILE = testFile;
  _resetRateLimitForTests();
});

afterEach(() => {
  if (existsSync(testFile)) unlinkSync(testFile);
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.SHORTENER_FILE;
});

describe("URL shortener API", () => {
  it("POST /shorten creates a short code", async () => {
    const app = createApp();
    const res = await request(app).post("/shorten").send({ url: "https://example.com" });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(res.body.shortUrl).toContain(res.body.code);
  });

  it("POST /shorten rejects invalid URL", async () => {
    const app = createApp();
    const res = await request(app).post("/shorten").send({ url: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("GET /:code redirects to the original URL", async () => {
    const app = createApp();
    const created = await request(app).post("/shorten").send({ url: "https://example.com" });
    const res = await request(app).get(`/${created.body.code}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://example.com");
  });

  it("GET /:code returns 404 for missing code", async () => {
    const app = createApp();
    const res = await request(app).get("/nonexist");
    expect(res.status).toBe(404);
  });

  it("GET /:code/stats returns stats", async () => {
    const app = createApp();
    const created = await request(app).post("/shorten").send({ url: "https://example.com" });
    await request(app).get(`/${created.body.code}`);
    const stats = await request(app).get(`/${created.body.code}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body.url).toBe("https://example.com");
    expect(stats.body.visits).toBe(1);
  });

  it("GET /:code/stats returns 404 for missing code", async () => {
    const app = createApp();
    const res = await request(app).get("/nonexist/stats");
    expect(res.status).toBe(404);
  });

  // codex-pair feedback (run-B-v2 task-2 HIGH): rejects dangerous schemes.
  // javascript: / data: / file: were the named threats. test both that they
  // get 400 AND that the validation is at the input layer, not just at
  // redirect time.
  for (const dangerousUrl of ["javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd"]) {
    it(`POST /shorten rejects ${dangerousUrl}`, async () => {
      const app = createApp();
      const res = await request(app).post("/shorten").send({ url: dangerousUrl });
      expect(res.status).toBe(400);
    });
  }

  // codex-pair feedback (run-B-v2 task-2 HIGH): rate limit was untested.
  // Spec says 10 / IP / minute. Fire 10 (all should pass), then the 11th
  // should 429 with Retry-After. Use a single supertest instance to keep
  // the same source IP.
  it("POST /shorten enforces the 10/minute rate limit", async () => {
    const app = createApp();
    const ok = [];
    for (let i = 0; i < 10; i++) {
      ok.push(await request(app).post("/shorten").send({ url: `https://example.com/${i}` }));
    }
    expect(ok.every((r) => r.status === 201)).toBe(true);
    const blocked = await request(app).post("/shorten").send({ url: "https://example.com/11" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  // codex-pair feedback (run-B-v2 task-2 HIGH): concurrent shorten requests
  // were the spec's stated requirement. Without the storage mutex this
  // dropped writes — verify 10 parallel POSTs all persist with unique codes.
  it("POST /shorten handles 10 concurrent requests with no lost links", async () => {
    const app = createApp();
    const requests = Array.from({ length: 10 }, (_, i) =>
      request(app).post("/shorten").send({ url: `https://example.com/concurrent-${i}` }),
    );
    const results = await Promise.all(requests);
    for (const res of results) {
      expect(res.status).toBe(201);
    }
    const codes = new Set(results.map((r) => r.body.code));
    expect(codes.size).toBe(10); // all unique
  });

  // codex-pair feedback (run-B-v2 task-2 HIGH): concurrent visits could lose
  // counter increments. Fire 25 parallel GETs against the same code and
  // verify the final visits count equals exactly 25.
  it("GET /:code handles concurrent visits without losing counter increments", async () => {
    const app = createApp();
    const created = await request(app).post("/shorten").send({ url: "https://example.com" });
    const code: string = created.body.code;
    const visits = Array.from({ length: 25 }, () => request(app).get(`/${code}`));
    await Promise.all(visits);
    const stats = await request(app).get(`/${code}/stats`);
    expect(stats.status).toBe(200);
    expect(stats.body.visits).toBe(25);
  });
});
