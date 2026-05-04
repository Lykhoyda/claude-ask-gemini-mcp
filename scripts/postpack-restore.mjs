#!/usr/bin/env node
/**
 * Restores package.json from package.json.bak AND removes bundled
 * node_modules/<dep>/ directories that prepack-bundle.mjs created.
 * Companion to prepack-bundle.mjs — see that file and ADR-052 for the
 * full rationale on bundling.
 *
 * Wired to the `postpack` lifecycle (NOT `postpublish`) so it fires
 * after `npm pack` AND after `npm publish` regardless of whether the
 * publish itself succeeded — defends against EOTP / network failures
 * that previously left the workspace in a half-bundled state where
 * the bundled `node_modules/@ask-llm/shared/` outranked the workspace
 * symlink in TS module resolution and silently broke local builds.
 *
 * Usage (mirrors prepack-bundle.mjs):
 *   node ../../scripts/postpack-restore.mjs shared
 *   node ../../scripts/postpack-restore.mjs shared gemini-mcp codex-mcp ollama-mcp
 *
 * Safe to run when no backup exists (no-op for the package.json half)
 * and when node_modules entries don't exist (no-op for the cleanup half).
 * Workspace-symlink entries are deliberately NOT removed — only real
 * directories created by the prepack copy are cleaned up.
 */
import fs from "node:fs";
import path from "node:path";

// 1. Restore package.json from .bak (the existing behavior).
if (fs.existsSync("package.json.bak")) {
  fs.renameSync("package.json.bak", "package.json");
  console.log("[postpack-restore] restored package.json from package.json.bak");
} else {
  console.log("[postpack-restore] no package.json.bak to restore");
}

// 2. Remove bundled node_modules/<dep>/ directories created by prepack-bundle.
//    Only delete real directories, never symlinks (which are the workspace
//    links yarn install created and we want to preserve).
const depsArg = process.argv.slice(2);
for (const dep of depsArg) {
  const destName = dep === "shared" ? "@ask-llm/shared" : `ask-${dep}`;
  const dest = path.join("node_modules", destName);
  if (!fs.existsSync(dest)) continue;
  const stat = fs.lstatSync(dest);
  if (stat.isSymbolicLink()) {
    // Workspace symlink — leave it alone.
    continue;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  console.log(`[postpack-restore] removed bundled ${dest}`);
}
