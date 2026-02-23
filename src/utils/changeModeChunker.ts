import type { ChangeModeEdit } from "./changeModeParser.js";

export interface EditChunk {
  edits: ChangeModeEdit[];
  chunkIndex: number;
  totalChunks: number;
  hasMore: boolean;
  estimatedChars: number;
}

function estimateEditSize(edit: ChangeModeEdit): number {
  const jsonOverhead = 250;
  const contentSize = edit.filename.length * 2 + edit.oldCode.length + edit.newCode.length;
  return jsonOverhead + contentSize;
}

function groupEditsByFile(edits: ChangeModeEdit[]): Map<string, ChangeModeEdit[]> {
  const groups = new Map<string, ChangeModeEdit[]>();
  for (const edit of edits) {
    const fileEdits = groups.get(edit.filename) || [];
    fileEdits.push(edit);
    groups.set(edit.filename, fileEdits);
  }
  return groups;
}
export function chunkChangeModeEdits(edits: ChangeModeEdit[], maxCharsPerChunk: number = 20000): EditChunk[] {
  if (edits.length === 0) {
    return [];
  }

  const chunks: EditChunk[] = [];
  const fileGroups = groupEditsByFile(edits);
  let currentChunk: ChangeModeEdit[] = [];
  let currentSize = 0;

  for (const [_filename, fileEdits] of fileGroups) {
    const fileSize = fileEdits.reduce((sum, edit) => sum + estimateEditSize(edit), 0);
    if (fileSize > maxCharsPerChunk) {
      if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, chunks.length + 1, currentSize));
        currentChunk = [];
        currentSize = 0;
      }
      for (const edit of fileEdits) {
        const editSize = estimateEditSize(edit);

        if (currentSize + editSize > maxCharsPerChunk && currentChunk.length > 0) {
          chunks.push(createChunk(currentChunk, chunks.length + 1, currentSize));
          currentChunk = [];
          currentSize = 0;
        }

        currentChunk.push(edit);
        currentSize += editSize;
      }
    } else {
      if (currentSize + fileSize > maxCharsPerChunk && currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk, chunks.length + 1, currentSize));
        currentChunk = [];
        currentSize = 0;
      }
      currentChunk.push(...fileEdits);
      currentSize += fileSize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk, chunks.length + 1, currentSize));
  }

  const totalChunks = chunks.length;
  return chunks.map((chunk, index) => ({
    ...chunk,
    totalChunks,
    hasMore: index < totalChunks - 1,
  }));
}

function createChunk(edits: ChangeModeEdit[], chunkIndex: number, estimatedChars: number): EditChunk {
  return {
    edits,
    chunkIndex,
    totalChunks: 0,
    hasMore: false,
    estimatedChars,
  };
}
