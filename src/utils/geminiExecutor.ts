import { CLI, ERROR_MESSAGES, EXECUTION, MODELS, STATUS_MESSAGES } from "../constants.js";
import { chunkChangeModeEdits } from "./changeModeChunker.js";
import { parseChangeModeOutput, validateChangeModeEdits } from "./changeModeParser.js";
import { formatChangeModeResponse, summarizeChangeModeEdits } from "./changeModeTranslator.js";
import { cacheChunks, getChunks } from "./chunkCache.js";
import { executeCommand } from "./commandExecutor.js";
import { Logger } from "./logger.js";

interface GeminiJsonResponse {
  response?: string;
  stats?: {
    inputTokens?: number;
    outputTokens?: number;
    model?: string;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

function formatStats(stats: GeminiJsonResponse["stats"]): string {
  if (!stats) return "";
  const parts: string[] = [];
  if (stats.inputTokens != null) parts.push(`${stats.inputTokens.toLocaleString()} input tokens`);
  if (stats.outputTokens != null) parts.push(`${stats.outputTokens.toLocaleString()} output tokens`);
  if (stats.model) parts.push(`model: ${stats.model}`);
  return parts.length > 0 ? `\n\n[Gemini stats: ${parts.join(", ")}]` : "";
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  if (start > 0) {
    Logger.debug(`Skipping ${start} chars of non-JSON prefix in Gemini output`);
  }
  return trimmed.slice(start);
}

function parseGeminiJsonOutput(raw: string): string {
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    Logger.debug("Gemini output has no JSON object, using raw text");
    return raw;
  }

  let parsed: GeminiJsonResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    Logger.debug("Gemini output is not valid JSON, using raw text");
    return raw;
  }

  if (parsed.error) {
    const msg = parsed.error.message ?? `Gemini error code ${parsed.error.code ?? "unknown"}`;
    throw new Error(msg);
  }

  if (typeof parsed.response !== "string") {
    Logger.debug("Gemini JSON missing response field, using raw text");
    return raw;
  }

  return parsed.response + formatStats(parsed.stats);
}

export async function executeGeminiCLI(
  prompt: string,
  model?: string,
  sandbox?: boolean,
  changeMode?: boolean,
  onProgress?: (newOutput: string) => void,
): Promise<string> {
  let prompt_processed = prompt;

  if (changeMode) {
    prompt_processed = prompt.replace(/file:(\S+)/g, "@$1");

    const changeModeInstructions = `
[CHANGEMODE INSTRUCTIONS]
You are generating code modifications that will be processed by an automated system. The output format is critical because it enables programmatic application of changes without human intervention.

INSTRUCTIONS:
1. Analyze each provided file thoroughly
2. Identify locations requiring changes based on the user request
3. For each change, output in the exact format specified
4. The OLD section must be EXACTLY what appears in the file (copy-paste exact match)
5. Provide complete, directly replacing code blocks
6. Verify line numbers are accurate

CRITICAL REQUIREMENTS:
1. Output edits in the EXACT format specified below - no deviations
2. The OLD string MUST be findable with Ctrl+F - it must be a unique, exact match
3. Include enough surrounding lines to make the OLD string unique
4. If a string appears multiple times (like </div>), include enough context lines above and below to make it unique
5. Copy the OLD content EXACTLY as it appears - including all whitespace, indentation, line breaks
6. Never use partial lines - always include complete lines from start to finish

OUTPUT FORMAT (follow exactly):
**FILE: [filename]:[line_number]**
\`\`\`
OLD:
[exact code to be replaced - must match file content precisely]
NEW:
[new code to insert - complete and functional]
\`\`\`

EXAMPLE 1 - Simple unique match:
**FILE: src/utils/helper.js:100**
\`\`\`
OLD:
function getMessage() {
  return "Hello World";
}
NEW:
function getMessage() {
  return "Hello Universe!";
}
\`\`\`

EXAMPLE 2 - Common tag needing context:
**FILE: index.html:245**
\`\`\`
OLD:
        </div>
      </div>
    </section>
NEW:
        </div>
      </footer>
    </section>
\`\`\`

IMPORTANT: The OLD section must be an EXACT copy from the file that can be found with Ctrl+F!

USER REQUEST:
${prompt_processed}
`;
    prompt_processed = changeModeInstructions;
  }

  const args = [];
  if (model) {
    args.push(CLI.FLAGS.MODEL, model);
  }
  if (sandbox) {
    args.push(CLI.FLAGS.SANDBOX);
  }
  args.push(CLI.FLAGS.OUTPUT_FORMAT, CLI.OUTPUT_FORMATS.JSON);
  args.push(CLI.FLAGS.PROMPT, prompt_processed);

  try {
    const raw = await executeCommand(CLI.COMMANDS.GEMINI, args, onProgress);
    return parseGeminiJsonOutput(raw);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) && model !== MODELS.FLASH) {
      Logger.warn(`${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`);
      Logger.debug(`Status: ${STATUS_MESSAGES.FLASH_RETRY}`);
      const fallbackArgs = [];
      fallbackArgs.push(CLI.FLAGS.MODEL, MODELS.FLASH);
      if (sandbox) {
        fallbackArgs.push(CLI.FLAGS.SANDBOX);
      }
      fallbackArgs.push(CLI.FLAGS.OUTPUT_FORMAT, CLI.OUTPUT_FORMATS.JSON);
      fallbackArgs.push(CLI.FLAGS.PROMPT, prompt_processed);
      try {
        const raw = await executeCommand(CLI.COMMANDS.GEMINI, fallbackArgs, onProgress);
        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        Logger.debug(`Status: ${STATUS_MESSAGES.FLASH_SUCCESS}`);
        return parseGeminiJsonOutput(raw);
      } catch (fallbackError) {
        const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: ${fallbackErrorMessage}`);
      }
    } else {
      throw error;
    }
  }
}

export function processChangeModeOutput(
  rawResult: string,
  chunkIndex?: number,
  chunkCacheKey?: string,
  prompt?: string,
): string {
  if (chunkIndex && chunkCacheKey) {
    const cachedChunks = getChunks(chunkCacheKey);
    if (cachedChunks && chunkIndex > 0 && chunkIndex <= cachedChunks.length) {
      Logger.debug(`Using cached chunk ${chunkIndex} of ${cachedChunks.length}`);
      const chunk = cachedChunks[chunkIndex - 1];
      let result = formatChangeModeResponse(chunk.edits, {
        current: chunkIndex,
        total: cachedChunks.length,
        cacheKey: chunkCacheKey,
      });

      if (chunkIndex === 1 && chunk.edits.length > 5) {
        const allEdits = cachedChunks.flatMap((c) => c.edits);
        result = `${summarizeChangeModeEdits(allEdits)}\n\n${result}`;
      }

      return result;
    }
    Logger.debug(`Cache miss or invalid chunk index, processing new result`);
  }

  const edits = parseChangeModeOutput(rawResult);

  if (edits.length === 0) {
    const truncated =
      rawResult.length > EXECUTION.ERROR_TRUNCATE_LENGTH
        ? rawResult.slice(0, EXECUTION.ERROR_TRUNCATE_LENGTH) +
          `\n... (truncated ${rawResult.length - EXECUTION.ERROR_TRUNCATE_LENGTH} chars)`
        : rawResult;
    return `No edits found in Gemini's response. Please ensure Gemini uses the OLD/NEW format. \n\n+ ${truncated}`;
  }

  const validation = validateChangeModeEdits(edits);
  if (!validation.valid) {
    return `Edit validation failed:\n${validation.errors.join("\n")}`;
  }

  const chunks = chunkChangeModeEdits(edits);

  let cacheKey: string | undefined;
  if (chunks.length > 1 && prompt) {
    cacheKey = cacheChunks(prompt, chunks);
    Logger.debug(`Cached ${chunks.length} chunks with key: ${cacheKey}`);
  }

  const returnChunkIndex = chunkIndex && chunkIndex > 0 && chunkIndex <= chunks.length ? chunkIndex : 1;
  const returnChunk = chunks[returnChunkIndex - 1];

  let result = formatChangeModeResponse(
    returnChunk.edits,
    chunks.length > 1 ? { current: returnChunkIndex, total: chunks.length, cacheKey } : undefined,
  );

  if (returnChunkIndex === 1 && edits.length > 5) {
    result = `${summarizeChangeModeEdits(edits, chunks.length > 1)}\n\n${result}`;
  }

  Logger.debug(
    `ChangeMode: Parsed ${edits.length} edits, ${chunks.length} chunks, returning chunk ${returnChunkIndex}`,
  );
  return result;
}
