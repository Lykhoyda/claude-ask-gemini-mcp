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
import { connectWebSocket } from "./broker-transport.mjs";
import { createRpcClient } from "./broker-rpc.mjs";

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

// Stale-state cleanup helper. SessionStart calls this BEFORE launching a
// fresh broker; the per-edit hook MAY call it on startup as a belt-and-
// suspenders defense (but the SessionStart path is the contract per
// ADR-090). Returns "absent" | "live" | "stale".
//
// Implementation lives in `broker-lifecycle.mjs` to keep the descriptor-
// read + cleanup primitives co-located with the rest of the lifecycle
// orchestration. Re-exported here so consumers (the per-edit hook in M4,
// codex-pair-session.mjs in this PR) can import a single contract surface.
//
// The implementation needs `BROKER_PROTOCOL_VERSION` (this module's
// constant) — so the lifecycle module imports it from here, and we
// re-export the function below. This avoids a circular dep because
// broker-lifecycle.mjs already imports initializeBroker from this file;
// adding BROKER_PROTOCOL_VERSION to that import doesn't introduce a new
// cycle.
export { clearStaleBrokerState } from "./broker-lifecycle.mjs";

// Open a transport connection to a running broker, perform the JSON-RPC
// `initialize` handshake, and return `{ connection, rpc, initializeResult }`.
// Caller owns connection lifetime — call `connection.close()` and stop
// using `rpc` when done. On any failure (transport error, handshake
// timeout, initialize rejection) this rejects; caller falls back to the
// per-edit spawn path per ADR-077.
//
// `clientInfo` is the InitializeParams.clientInfo object — codex-cli
// 0.130.0 requires `{ name, title, version }` (brainstorm-verified;
// ADR-093 protocol note). Callers should pass real plugin identity.
export async function initializeBroker(transportUrl, clientInfo, options = {}) {
  const { handshakeTimeoutMs = 5000, initializeTimeoutMs = 5000 } = options;
  const connection = await connectWebSocket(transportUrl, { handshakeTimeoutMs });
  const rpc = createRpcClient(connection, { defaultTimeoutMs: initializeTimeoutMs });
  try {
    const initializeResult = await rpc.request(
      JSONRPC_METHODS.INITIALIZE,
      { clientInfo },
      { timeoutMs: initializeTimeoutMs },
    );
    return { connection, rpc, initializeResult };
  } catch (err) {
    try {
      connection.close(1011, "initialize failed");
    } catch {
      // already torn down
    }
    throw err;
  }
}

// Health probe: open the transport, send `model/list` (idempotent, cheap),
// wait up to BROKER_HEALTH_TIMEOUT_MS for a response. Returns boolean.
// Never throws — callers in the hook path treat any failure as "broker
// unreachable, fall back to per-edit spawn" per ADR-077.
//
// `state` is the broker descriptor read from .codex-pair/state/broker.json
// (shape: `{ transportUrl, pid, codexVersion, protocolVersion, startedAt }`).
// Health probe uses transportUrl + initializes ad-hoc because the long-
// lived connection lives in the per-edit hook process, not here.
//
// Implementation note: model/list is preferred over `initialize` for the
// probe because the brainstorm verified that codex's `initialize` is
// metadata-rich + always-succeeds. `model/list` exercises the actual
// JSON-RPC plumbing AND validates that the broker can complete a real
// request — a stricter health signal.
export async function probeBrokerHealth(state) {
  if (!state || typeof state.transportUrl !== "string") return false;
  let connection;
  let rpc;
  try {
    connection = await connectWebSocket(state.transportUrl, {
      handshakeTimeoutMs: BROKER_HEALTH_TIMEOUT_MS,
    });
    rpc = createRpcClient(connection, { defaultTimeoutMs: BROKER_HEALTH_TIMEOUT_MS });
    // `model/list` requires the connection to have completed `initialize`
    // first per the codex protocol. The PROBE path opens a fresh
    // connection (no broker-side state shared with the long-lived hook
    // connection), so we must initialize here before model/list.
    await rpc.request(
      JSONRPC_METHODS.INITIALIZE,
      { clientInfo: { name: "codex-pair-health-probe", title: "codex-pair health probe", version: "0.0.0" } },
      { timeoutMs: BROKER_HEALTH_TIMEOUT_MS },
    );
    await rpc.request(JSONRPC_METHODS.MODEL_LIST, undefined, {
      timeoutMs: BROKER_HEALTH_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  } finally {
    if (connection && !connection.destroyed) {
      try {
        connection.close(1000, "probe done");
      } catch {
        // best-effort
      }
    }
  }
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
