# Benchmark task 2: URL shortener service

Stepped-up complexity vs. task 1 (todo app). Where the todo app exercised mostly **concurrency** failures, this task probes five distinct bug categories so a successful Run-B-v2 demonstrates codex's review *generalizes* beyond the patterns it caught in task 1.

## The prompt to give Claude

> Build a small TypeScript Express service that shortens URLs. Endpoints:
>
> - `POST /shorten` — body `{ url: string }`, returns `{ code: string, shortUrl: string }` (201)
> - `GET /:code` — redirects (302) to the original URL; if `code` doesn't exist, return 404
> - `GET /:code/stats` — returns `{ url, code, visits, createdAt }`; 404 if `code` doesn't exist
>
> Requirements:
> - Persist all data to a JSON file (`shortener.json`) with safe concurrent writes
> - Short codes are **6-char base62** (`[A-Za-z0-9]{6}`), generated with collision handling
> - Apply a rate limit of **10 `POST /shorten` requests per IP per minute** (sliding or fixed window, your choice — return 429 with `Retry-After` header when exceeded)
> - Increment a per-code `visits` counter on every successful redirect (concurrent-safe)
> - Use Express 5, TypeScript strict mode, Zod for input validation
> - Include vitest tests covering happy paths + at least one error case per endpoint
> - `tsc --noEmit` and `vitest run` must pass

The spec deliberately does NOT mention URL scheme validation, collision exhaustion behavior, rate-limit-window subtleties, or counter atomicity. Those should emerge from a careful reviewer's read of the code — which is what codex is being tested on.

## The five bug-prone surfaces being probed

### Surface 1: Concurrent JSON file writes (control test)

Same shape as task 1 — multiple writers race on read-modify-write of `shortener.json`. We KNOW codex caught this in task 1; this run validates it generalizes. **Expected codex catch: HIGH (mutex needed).**

### Surface 2: Destination URL validation (security — NEW)

`POST /shorten` accepts arbitrary string URLs. A naive impl stores whatever comes in and redirects to it on `GET /:code`. That allows:
- `javascript:alert(1)` schemes → XSS when the user clicks a malicious short URL
- `data:` schemes → arbitrary content injection
- `file://` schemes → SSRF / local file inclusion attempts (no real impact in Express but a smell)
- Unbounded URL length → DoS by stuffing
- Localhost / private-network destinations → open redirect into internal services

A good Run-A might naively use `new URL(...)` to "validate," which doesn't catch the scheme issue. **Expected codex catch: HIGH (scheme allowlist needed).** This is the most interesting probe — spec doesn't mention it.

### Surface 3: Short-code generation collision handling (algorithm — NEW)

6-char base62 = 56.8B possible codes. Generating with collision retry seems safe — until the table is mostly full and retries explode. Three subtle failures:

1. **Unbounded retry loop**: `do { code = generate(); } while (await exists(code));` loops forever if all 56.8B codes are taken (unlikely in practice but smells)
2. **Birthday-paradox surprise**: collision probability rises with √n; at ~10M codes stored, retries kick in noticeably
3. **Hot loop on Math.random** when the table is dense: degrades latency

A good reviewer flags the unbounded loop with a maximum retry count + 503-on-exhaustion fallback. **Expected codex catch: MED (unbounded loop, retry cap).**

### Surface 4: Rate limit accuracy (state management — NEW)

"10 per IP per minute" can be implemented many ways:
- **Fixed window**: count requests in the current minute. Burst of 20 at 59s + 1s = 20 in 2 seconds. Trivial bypass.
- **Sliding window**: more accurate but harder to get right. Off-by-one on the window-eviction logic is common.
- **Token bucket**: cleanest but rarely what people write first.

A naive `if (count > 10) reject` likely uses fixed window without acknowledging it. **Expected codex catch: MED (window-edge bypass).**

### Surface 5: Visit counter atomicity (concurrency — NEW shape)

Different from CRUD-on-todos. The visit counter is a HOT path:
- `GET /:code` fires the increment on every read
- A popular code might see hundreds of concurrent reads
- Naive read-modify-write loses counts under load

Also distinct because the increment is *read-then-write a single integer*, not the full file. A reviewer might suggest a different mutex strategy than the storage-wide lock (per-code lock, or atomic counter store). **Expected codex catch: HIGH (counter race, distinct from store-wide lock).**

## What a strong Run-B-v2 outcome looks like

Per-axis pass criteria (does codex's feedback induce a fix?):

- [ ] **Surface 1**: Mutex/queue around storage writes (same pattern as task 1)
- [ ] **Surface 2**: Scheme allowlist (e.g., only `http:` and `https:`) + URL parse-check
- [ ] **Surface 3**: Max-retry counter on code generation with 503 fallback
- [ ] **Surface 4**: Either sliding-window done correctly, or explicit acknowledgement that the chosen window has known edge-bypass and a token-bucket alternative
- [ ] **Surface 5**: Counter increment protected (either inside the storage mutex, or a separate cheaper mechanism)

**Plus the baseline tsc/vitest gates from task 1:** clean tsc, all tests pass, no `any` casts, runtime errors are caught not 500'd.

## What "negative result" looks like

If codex says NONE on routes.ts, storage.ts, or the rate-limiter file: the v2 prompt is still too narrow or codex genuinely can't see these issues. That'd be a meaningful negative signal.

If codex catches surface 1 but misses 2-5: concurrency-specific win, not a generalized review capability. Important to document.

If codex catches 4 of 5 (one miss): N=2 with 90%+ recall — strong evidence the v2 prompt design is robust.

## Why this benchmark is harder than task 1

In task 1, the spec said "the server must handle concurrent requests safely (no race conditions on the file)" — codex had a direct hook to flag concurrency.

In task 2, the spec mentions concurrency ONLY for the file write (surface 1). Surfaces 2-5 require codex to engineer-review beyond the spec. This tests whether codex's value-add is "spec checker" (low ceiling) or "engineering reviewer" (high ceiling).
