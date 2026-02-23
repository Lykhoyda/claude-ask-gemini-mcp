import { describe, expect, it } from "vitest";
import type { ChangeModeEdit } from "../changeModeParser.js";
import { formatChangeModeResponse, summarizeChangeModeEdits } from "../changeModeTranslator.js";

const sampleEdit: ChangeModeEdit = {
  filename: "src/index.ts",
  oldStartLine: 10,
  oldEndLine: 12,
  oldCode: "const x = 1;\nconst y = 2;",
  newStartLine: 10,
  newEndLine: 12,
  newCode: "const x = 10;\nconst y = 20;",
};

describe("formatChangeModeResponse", () => {
  it("formats single-chunk response without chunkInfo", () => {
    const result = formatChangeModeResponse([sampleEdit]);

    expect(result).toContain("[CHANGEMODE OUTPUT");
    expect(result).toContain("1 modification");
    expect(result).toContain("### Edit 1: src/index.ts");
    expect(result).toContain("const x = 1;");
    expect(result).toContain("const x = 10;");
    expect(result).not.toContain("fetch-chunk");
  });

  it("formats multi-chunk response with fetch-chunk instructions", () => {
    const result = formatChangeModeResponse([sampleEdit], {
      current: 1,
      total: 3,
      cacheKey: "abc-123",
    });

    expect(result).toContain("Chunk 1 of 3");
    expect(result).toContain("1 complete edit");
    expect(result).toContain("fetch-chunk");
    expect(result).toContain("abc-123");
    expect(result).toContain("chunkIndex");
    expect(result).toContain("2 more chunks");
  });

  it("formats last chunk without next-chunk instructions", () => {
    const result = formatChangeModeResponse([sampleEdit], {
      current: 3,
      total: 3,
      cacheKey: "abc-123",
    });

    expect(result).toContain("Chunk 3 of 3");
    expect(result).not.toContain("Next Step");
    expect(result).not.toContain("CONTINUE");
  });

  it("pluralizes modifications correctly", () => {
    const single = formatChangeModeResponse([sampleEdit]);
    expect(single).toContain("1 modification");

    const multiple = formatChangeModeResponse([sampleEdit, { ...sampleEdit, filename: "b.ts" }]);
    expect(multiple).toContain("2 modifications");
  });

  it("numbers edits sequentially", () => {
    const edits = [sampleEdit, { ...sampleEdit, filename: "b.ts" }, { ...sampleEdit, filename: "c.ts" }];

    const result = formatChangeModeResponse(edits);

    expect(result).toContain("### Edit 1: src/index.ts");
    expect(result).toContain("### Edit 2: b.ts");
    expect(result).toContain("### Edit 3: c.ts");
  });
});

describe("summarizeChangeModeEdits", () => {
  it("summarizes file count and edit count", () => {
    const edits = [sampleEdit, { ...sampleEdit, filename: "b.ts" }];

    const result = summarizeChangeModeEdits(edits);

    expect(result).toContain("Total edits: 2");
    expect(result).toContain("Files affected: 2");
    expect(result).toContain("- src/index.ts: 1 edit");
    expect(result).toContain("- b.ts: 1 edit");
  });

  it("groups multiple edits per file", () => {
    const edits = [sampleEdit, { ...sampleEdit }, { ...sampleEdit, filename: "b.ts" }];

    const result = summarizeChangeModeEdits(edits);

    expect(result).toContain("Total edits: 3");
    expect(result).toContain("Files affected: 2");
    expect(result).toContain("- src/index.ts: 2 edits");
  });

  it("shows partial view header when isPartialView is true", () => {
    const result = summarizeChangeModeEdits([sampleEdit], true);

    expect(result).toContain("Complete analysis across all chunks");
    expect(result).toContain("across all chunks");
  });

  it("shows standard header when isPartialView is false/undefined", () => {
    const result = summarizeChangeModeEdits([sampleEdit]);

    expect(result).toContain("ChangeMode Summary:");
    expect(result).not.toContain("across all chunks");
  });
});
