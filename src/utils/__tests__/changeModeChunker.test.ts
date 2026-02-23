import { describe, expect, it } from "vitest";
import { chunkChangeModeEdits } from "../changeModeChunker.js";
import type { ChangeModeEdit } from "../changeModeParser.js";

function makeEdit(filename: string, oldCode: string, newCode: string): ChangeModeEdit {
  return {
    filename,
    oldStartLine: 1,
    oldEndLine: 1,
    oldCode,
    newStartLine: 1,
    newEndLine: 1,
    newCode,
  };
}

describe("chunkChangeModeEdits", () => {
  it("returns empty array for empty input", () => {
    expect(chunkChangeModeEdits([])).toEqual([]);
  });

  it("returns single chunk for one small edit", () => {
    const edits = [makeEdit("a.ts", "old", "new")];
    const chunks = chunkChangeModeEdits(edits);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].edits).toEqual(edits);
    expect(chunks[0].chunkIndex).toBe(1);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].hasMore).toBe(false);
  });

  it("splits large edits into multiple chunks", () => {
    const bigContent = "x".repeat(5000);
    const edits = [
      makeEdit("a.ts", bigContent, bigContent),
      makeEdit("b.ts", bigContent, bigContent),
      makeEdit("c.ts", bigContent, bigContent),
    ];

    const chunks = chunkChangeModeEdits(edits, 6000);

    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i + 1);
      expect(chunks[i].totalChunks).toBe(chunks.length);
      expect(chunks[i].hasMore).toBe(i < chunks.length - 1);
    }

    const allEdits = chunks.flatMap((c) => c.edits);
    expect(allEdits).toHaveLength(3);
  });

  it("groups edits by file within a chunk", () => {
    const edits = [
      makeEdit("a.ts", "old1", "new1"),
      makeEdit("a.ts", "old2", "new2"),
      makeEdit("b.ts", "old3", "new3"),
    ];

    const chunks = chunkChangeModeEdits(edits);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].edits).toHaveLength(3);
  });

  it("respects custom maxCharsPerChunk", () => {
    const edits = [
      makeEdit("a.ts", "x".repeat(200), "y".repeat(200)),
      makeEdit("b.ts", "x".repeat(200), "y".repeat(200)),
    ];

    const chunks = chunkChangeModeEdits(edits, 500);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("sets estimatedChars on each chunk", () => {
    const edits = [makeEdit("a.ts", "old", "new")];
    const chunks = chunkChangeModeEdits(edits);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].estimatedChars).toBeGreaterThan(0);
  });

  it("last chunk has hasMore=false", () => {
    const bigContent = "x".repeat(8000);
    const edits = [makeEdit("a.ts", bigContent, bigContent), makeEdit("b.ts", bigContent, bigContent)];

    const chunks = chunkChangeModeEdits(edits, 5000);
    const lastChunk = chunks[chunks.length - 1];

    expect(lastChunk.hasMore).toBe(false);
    expect(lastChunk.chunkIndex).toBe(lastChunk.totalChunks);
  });
});
