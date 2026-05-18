#!/usr/bin/env node
// Mirror packages/claude-plugin/package.json `version` into the two other
// manifests that carry the same version field:
//   - packages/claude-plugin/.claude-plugin/plugin.json (read by Claude Code)
//   - .claude-plugin/marketplace.json (the marketplace listing)
//
// Run automatically after `yarn changeset version` via the `changeset:version`
// composed script. Keeps the three manifests in lockstep so a contributor can
// never accidentally ship a version mismatch.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "packages/claude-plugin/package.json");
const PLUGIN_JSON = resolve(ROOT, "packages/claude-plugin/.claude-plugin/plugin.json");
const MARKETPLACE_JSON = resolve(ROOT, ".claude-plugin/marketplace.json");
const PLUGIN_NAME = "ask-llm";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function syncPluginJson(version) {
  const pluginJson = await readJson(PLUGIN_JSON);
  if (pluginJson.version === version) return false;
  pluginJson.version = version;
  await writeJson(PLUGIN_JSON, pluginJson);
  return true;
}

async function syncMarketplaceJson(version) {
  const marketplace = await readJson(MARKETPLACE_JSON);
  const entry = marketplace.plugins?.find((p) => p.name === PLUGIN_NAME);
  if (!entry) {
    throw new Error(`marketplace.json: no plugin entry named "${PLUGIN_NAME}"`);
  }
  if (entry.version === version) return false;
  entry.version = version;
  await writeJson(MARKETPLACE_JSON, marketplace);
  return true;
}

async function main() {
  const source = await readJson(SOURCE);
  const version = source.version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${SOURCE}: missing "version" field`);
  }

  const pluginChanged = await syncPluginJson(version);
  const marketplaceChanged = await syncMarketplaceJson(version);

  if (pluginChanged || marketplaceChanged) {
    const changed = [
      pluginChanged ? "plugin.json" : null,
      marketplaceChanged ? "marketplace.json" : null,
    ].filter(Boolean);
    console.log(`sync-plugin-manifests: synced ${version} to ${changed.join(", ")}`);
  } else {
    console.log(`sync-plugin-manifests: already at ${version}, no changes`);
  }
}

main().catch((err) => {
  console.error(`sync-plugin-manifests: ${err.message}`);
  process.exit(1);
});
