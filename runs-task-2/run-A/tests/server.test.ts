import { describe, it, expect, beforeEach } from "vitest";
import { unlinkSync, existsSync } from "node:fs";
import request from "supertest";
import { createApp } from "../src/server.js";

const TEST_FILE = "shortener.json";

beforeEach(() => {
  if (existsSync(TEST_FILE)) {
    unlinkSync(TEST_FILE);
  }
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
    // Visit it
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
});
