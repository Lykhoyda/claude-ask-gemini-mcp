const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 6;

// codex-pair feedback (run-B-v2 task-2): the previous generateUniqueCode had
// a TOCTOU race (check-then-insert across separate awaits) and an unbounded
// retry loop. Both fixes live in storage.createWithUniqueCode now:
//   - codes.ts is reduced to a pure code generator (no I/O, no retry loop)
//   - storage.createWithUniqueCode owns the atomic generate+insert under a
//     mutex with a bounded retry count
export function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

// Maximum attempts to generate a unique code before giving up. Set well
// below the birthday-bound for 6-char base62 (~244M) — exhaustion at this
// scale is a real signal the code space is saturated, not noise.
export const MAX_CODE_ALLOCATION_ATTEMPTS = 16;
