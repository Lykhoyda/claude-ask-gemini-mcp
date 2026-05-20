// App-server broker interface (ADR-090, refined per ADR-093).
//
// Future home of the long-lived codex sidecar that replaces per-edit cold
// spawns with persistent JSON-RPC requests. Today this module defines the
// API surface and stable state-file layout — the implementation lands
// across Tier 3 follow-on milestones 2–4 tracked in docs/ROADMAP.md.
//
// **Status:** interface defined; implementation deferred. The `isBrokerEnabled`
// check returns false until ASK_CODEX_BROKER=1 ships alongside a real
// implementation. The hook MUST treat broker absence as a no-op and fall
// back to the existing per-edit codex spawn (ADR-077). This keeps the
// happy path byte-identical to v0.6.6 until the broker stabilizes.
//
// See ADR-090 for original design rationale (transport, lifecycle,
// failure modes, stale-daemon recovery). See ADR-093 for the protocol
// discovery findings that refined this interface against the real
// `codex app-server` JSON-RPC surface (codex-cli 0.130.0+):
//   - Transport: unix:// (POSIX) / ws:// (Windows), via `--listen` flag
//   - Handshake: JSON-RPC `initialize` with clientInfo
//   - Per-review: `thread/start` (ephemeral) + `turn/start` (with
//     outputSchema constraint) + listen for `turn/completed` notification
//   - Cancellation: `turn/interrupt` on the in-flight turn id
//   - Health probe: `model/list` (cheap) or `initialize` with deadline

import { join } from "node:path";

// State file under <markerDir>/.codex-pair/state/ (ADR-092).
export const BROKER_STATE_FILE = "broker.json";
export const BROKER_HEALTH_TIMEOUT_MS = 2000;
export const BROKER_SOCKET_PREFIX = "codex-pair-broker";

// Protocol version we target. Pinned so a codex CLI upgrade with breaking
// protocol changes is detected at handshake time rather than silently
// producing malformed requests. Verified empirically against codex-cli
// 0.130.0 via `codex app-server generate-json-schema`; ADR-093 documents
// the methods + notification stream we depend on.
export const BROKER_PROTOCOL_VERSION = "v2";

// JSON-RPC client → server methods codex-pair USES (subset of the 75
// available; see ADR-093). Pinning these here documents the contract and
// lets structural tests catch silent drift.
export const JSONRPC_METHODS = Object.freeze({
  INITIALIZE: "initialize",
  THREAD_START: "thread/start",
  TURN_START: "turn/start",
  TURN_INTERRUPT: "turn/interrupt",
  MODEL_LIST: "model/list", // used for health probe (cheap, no side effects)
});

// JSON-RPC server → client notifications codex-pair LISTENS for. Subset
// of the full event stream; we ignore the rest. `TURN_COMPLETED` is the
// terminal event that carries the final agent message (which carries the
// structured verdict when outputSchema is set).
export const JSONRPC_NOTIFICATIONS = Object.freeze({
  TURN_COMPLETED: "turn/completed",
  TURN_STARTED: "turn/started",
  ITEM_AGENT_MESSAGE_DELTA: "item/agentMessage/delta", // streaming text
  THREAD_TOKEN_USAGE_UPDATED: "thread/tokenUsage/updated", // cost tracking
});

// Build the JSON Schema we send as `outputSchema` on `turn/start`. Codex
// constrains the agent's final message to this shape per ADR-093, which
// means we get a structured verdict back without prose-parsing (per
// ADR-083's verdict contract). Centralized here so test fixtures and
// production code build the same schema.
export function buildVerdictSchema() {
  return {
    type: "object",
    required: ["verdict", "concerns"],
    additionalProperties: false,
    properties: {
      verdict: {
        type: "string",
        enum: ["none", "concerns"],
        description: "ADR-083 verdict closed set.",
      },
      concerns: {
        type: "object",
        required: ["high", "med", "low"],
        additionalProperties: false,
        properties: {
          high: {
            type: "array",
            items: { type: "string" },
            description: "HIGH-severity concerns. Surfaced via systemMessage.",
          },
          med: {
            type: "array",
            items: { type: "string" },
            description: "MED-severity concerns. Surfaced via systemMessage.",
          },
          low: {
            type: "array",
            items: { type: "string" },
            description: "LOW-severity concerns. Logged only (ADR-077 threshold).",
          },
        },
      },
    },
  };
}

// Single source of truth for "is the broker active for this project right
// now". Reads .codex-pair/state/broker.json and returns the broker descriptor
// (transport URL, pid, started_at, codex version, protocol version) or null
// if no broker is running. The hook's main flow checks this BEFORE the
// cache + inflight lock; a live broker bypasses both because the broker
// itself coordinates concurrent requests.
//
// The implementation is intentionally stubbed for v0.7.x Milestone 1.
// Returning null here causes every hook invocation to fall through to the
// existing per-edit spawn path — byte-identical behavior to pre-broker.
export function readBrokerState(_markerDir) {
  return null;
}

// Stable predicate the hook can call without knowing the broker mechanics.
// Returns true iff (a) ASK_CODEX_BROKER=1 in env, (b) readBrokerState
// returns a non-null descriptor, (c) the broker process is alive AND
// answered a health probe within BROKER_HEALTH_TIMEOUT_MS. Today (b) is
// stubbed to null, so this is always false.
export function isBrokerEnabled(markerDir) {
  if (process.env.ASK_CODEX_BROKER !== "1") return false;
  const state = readBrokerState(markerDir);
  if (!state) return false;
  return false; // implementation deferred — see ADR-093 Milestone 3
}

// Path resolver for the per-marker-dir broker state file. Used by the
// SessionStart hook (writer) and the per-edit hook (reader).
export function brokerStatePath(markerDir, stateDir) {
  return join(markerDir, stateDir, BROKER_STATE_FILE);
}

// Stale-state cleanup helper. SessionStart calls this before launching a
// fresh broker; the per-edit hook MAY call it on startup as a belt-and-
// suspenders defense (but the SessionStart path is the contract).
// Implementation deferred to Milestone 4.
export function clearStaleBrokerState(_markerDir) {
  // Read .codex-pair/state/broker.json; if pid is dead OR socket is gone
  // OR codex version doesn't match the recorded one OR protocol version
  // doesn't match BROKER_PROTOCOL_VERSION, unlink the state file so the
  // next request falls through to a fresh spawn or a fresh broker launch
  // (per the configured policy).
}

// Health-probe stub. Real implementation (Milestone 3) will open the
// transport (unix socket or websocket), send `model/list` (cheap, no side
// effects), wait up to BROKER_HEALTH_TIMEOUT_MS for a response, and
// return boolean. `model/list` is preferred over `initialize` for the
// probe because initialize has side effects (allocates a connection
// context); model/list is idempotent and lighter.
export async function probeBrokerHealth(_state) {
  return false;
}

// Submit-review API. The hook calls this when isBrokerEnabled returns
// true. Today never reached. Real implementation (Milestone 3) performs
// a 3-step JSON-RPC dance per ADR-093:
//   1. `thread/start { ephemeral: true, cwd, baseInstructions, model,
//      approvalPolicy: "never", sandbox: <readonly> }`
//      → receives { thread: { id } }
//   2. `turn/start { threadId, input: [{type:"text", text: prompt}],
//      outputSchema: buildVerdictSchema(), effort: "high" }`
//      → receives { turn: { id } }
//   3. Listen on the JSON-RPC connection for `turn/completed`
//      notification; extract the final agentMessage; parse its JSON
//      content (constrained by outputSchema) into the verdict shape;
//      return same shape spawnCodex returns today.
//
// On abort signal: send `turn/interrupt { turnId }` and reject the
// promise. On timeout: same. On schema-violating output (rare per ADR-093
// risk acceptance): reject; caller falls through to per-edit spawn per
// ADR-077's silent-on-error contract.
//
// Args object shape (refined from ADR-090's `(state, prompt, options)`):
//   { state, baseInstructions, prompt, model, threadOptions, abortSignal }
// Returns: { agentMessage: string, tokenUsage: { ... }, durationMs: number }
// — mirrors the shape spawnCodex currently produces so the hook's main()
// integration is a one-line substitution.
export async function submitReview(_args) {
  throw new Error(
    "Broker submitReview not implemented yet — see ADR-093 Milestone 3",
  );
}
