import { describe, expect, it } from "vitest";
import { listFiles, listSubdirs, parseMarkdownFrontmatter, readFile } from "./_helpers.js";

const expectedSkills = [
  "brainstorm",
  "brainstorm-all",
  "codex-image",
  "codex-review",
  "compare",
  "gemini-review",
  "multi-review",
  "ollama-review",
];
const expectedAgents = ["brainstorm-coordinator.md", "codex-reviewer.md", "gemini-reviewer.md", "ollama-reviewer.md"];

describe("skills/", () => {
  it("contains the expected set of skill directories", () => {
    const dirs = listSubdirs("skills").sort();
    expect(dirs).toEqual(expectedSkills.sort());
  });

  it.each(expectedSkills)("%s skill has SKILL.md with required frontmatter", (skillName) => {
    const content = readFile(`skills/${skillName}/SKILL.md`);
    const { frontmatter, body } = parseMarkdownFrontmatter(content);

    expect(frontmatter.name).toBe(skillName);
    expect(frontmatter.description).toBeTruthy();
    expect(typeof frontmatter.description).toBe("string");
    expect((frontmatter.description as string).length).toBeGreaterThan(20);
    expect(body.trim().length).toBeGreaterThan(0);
  });

  it.each(expectedSkills)("%s skill description includes triggering language", (skillName) => {
    const content = readFile(`skills/${skillName}/SKILL.md`);
    const { frontmatter } = parseMarkdownFrontmatter(content);
    const desc = frontmatter.description as string;
    expect(desc).toMatch(/should be used|when the user|asks to|wants to|review|brainstorm/i);
  });

  it("user_invocable skills are clearly marked", () => {
    for (const skill of expectedSkills) {
      const { frontmatter } = parseMarkdownFrontmatter(readFile(`skills/${skill}/SKILL.md`));
      if (frontmatter.user_invocable !== undefined) {
        expect(["true", "false"]).toContain(String(frontmatter.user_invocable));
      }
    }
  });
});

describe("agents/", () => {
  it("contains the expected set of agent files", () => {
    const files = listFiles("agents", ".md").sort();
    expect(files).toEqual(expectedAgents.sort());
  });

  it.each(expectedAgents)("%s has required frontmatter fields", (agentFile) => {
    const content = readFile(`agents/${agentFile}`);
    const { frontmatter, body } = parseMarkdownFrontmatter(content);

    expect(frontmatter.name).toBeTruthy();
    expect(frontmatter.description).toBeTruthy();
    expect((frontmatter.description as string).length).toBeGreaterThan(40);
    expect(body.trim().length).toBeGreaterThan(100);
  });

  it.each(expectedAgents)("%s declares a model and color", (agentFile) => {
    const { frontmatter } = parseMarkdownFrontmatter(readFile(`agents/${agentFile}`));
    expect(frontmatter.model).toBeTruthy();
    expect(frontmatter.color).toBeTruthy();
  });

  it("each reviewer agent has its provider's MCP tool in the tools list", () => {
    const cases: Array<{ file: string; tool: string }> = [
      { file: "gemini-reviewer.md", tool: "mcp__gemini__ask-gemini" },
      { file: "codex-reviewer.md", tool: "mcp__codex__ask-codex" },
      { file: "ollama-reviewer.md", tool: "mcp__ollama__ask-ollama" },
    ];
    for (const { file, tool } of cases) {
      const { frontmatter } = parseMarkdownFrontmatter(readFile(`agents/${file}`));
      const tools = frontmatter.tools;
      expect(Array.isArray(tools)).toBe(true);
      expect(tools as string[]).toContain(tool);
    }
  });

  it("review agents are restricted from edit/write tools", () => {
    const reviewerAgents = ["gemini-reviewer.md", "codex-reviewer.md", "ollama-reviewer.md"];
    for (const file of reviewerAgents) {
      const { frontmatter } = parseMarkdownFrontmatter(readFile(`agents/${file}`));
      const tools = frontmatter.tools as string[] | undefined;
      if (!tools) continue;
      expect(tools).not.toContain("Edit");
      expect(tools).not.toContain("Write");
      expect(tools).not.toContain("NotebookEdit");
    }
  });
});

describe("multi-review skill — load-bearing polish (ADR-064)", () => {
  const content = readFile("skills/multi-review/SKILL.md");
  const { body } = parseMarkdownFrontmatter(content);

  it("documents diff preprocessing (intent-to-add for new files)", () => {
    expect(body).toMatch(/git add -N/);
  });

  it("documents pathspec exclusion of docs and binaries", () => {
    expect(body).toMatch(/!docs\//);
    expect(body).toMatch(/!\*\.md/);
  });

  it("specifies size-check tiers (50KB / 150KB)", () => {
    expect(body).toMatch(/50.{0,5}KB/);
    expect(body).toMatch(/150.{0,5}KB/);
  });

  it("requires a per-finding verification step before presenting", () => {
    expect(body).toMatch(/[Vv]erif/);
    expect(body).toMatch(/Read.{0,30}file/);
  });

  it("classifies findings as VERIFIED / REJECTED / UNVERIFIABLE", () => {
    expect(body).toMatch(/VERIFIED/);
    expect(body).toMatch(/REJECTED/);
    expect(body).toMatch(/UNVERIFIABLE/);
  });

  it("documents fallback dispatch via dist runner binaries", () => {
    expect(body).toMatch(/dist\/run\.js/);
    expect(body).toMatch(/dist\/codex-run\.js/);
  });

  it("includes the ADR-050 dispatch pattern (direct backgrounding + per-PID wait)", () => {
    expect(body).toMatch(/&\s*\ngem_pid=\$!|& gem_pid=\$!/);
    expect(body).toMatch(/wait \$gem_pid|wait "\$gem_pid"/);
  });

  it("forbids raw provider CLI invocation (preserves quota fallback + stdin handling)", () => {
    expect(body).toMatch(/[Dd]o NOT use raw|bypass.{0,40}quota fallback/);
  });

  it("requires resilient failure handling (don't silently drop a failed provider)", () => {
    expect(body).toMatch(/[Dd]o NOT silently drop|silently drop|surface the failure/i);
  });
});

describe("brainstorm skill — polish (ADR-064)", () => {
  const content = readFile("skills/brainstorm/SKILL.md");
  const { body } = parseMarkdownFrontmatter(content);

  it("documents diff preprocessing for code-context brainstorms", () => {
    expect(body).toMatch(/git add -N/);
    expect(body).toMatch(/!docs\//);
  });

  it("warns about diff size (>150KB threshold)", () => {
    expect(body).toMatch(/150.{0,5}KB/);
  });

  it("notes that confidence scores are not an oracle", () => {
    expect(body).toMatch(/[Cc]onfidence scores are not an oracle/);
  });

  it("points users to /multi-review for source-verified code review", () => {
    expect(body).toMatch(/\/multi-review/);
  });
});

describe("brainstorm-coordinator agent — Phase 4 cross-check polish (ADR-064)", () => {
  const content = readFile("agents/brainstorm-coordinator.md");
  const { body } = parseMarkdownFrontmatter(content);

  it("documents the cross-check step before promoting external findings", () => {
    expect(body).toMatch(/[Cc]ross-check/);
  });

  it("classifies findings as Verified / Rejected / Unverifiable in synthesis", () => {
    expect(body).toMatch(/Verified.*Rejected.*Unverifiable/s);
  });

  it("includes a Rejected section in the synthesis to surface false positives", () => {
    expect(body).toMatch(/Rejected.*false positives/i);
  });
});

describe("compare skill — load-bearing structure", () => {
  const content = readFile("skills/compare/SKILL.md");
  const { frontmatter, body } = parseMarkdownFrontmatter(content);

  it("is user-invocable", () => {
    expect(String(frontmatter.user_invocable)).toBe("true");
  });

  it("description differentiates from /brainstorm and /multi-review", () => {
    const desc = frontmatter.description as string;
    expect(desc).toMatch(/side-by-side|verbatim|raw responses|without synthesis/i);
  });

  it("documents the ADR-050 dispatch pattern (direct backgrounding + per-PID wait)", () => {
    expect(body).toMatch(/&\s*pid=\$!|& gem_pid=\$!/);
    expect(body).toMatch(/wait \$/);
  });

  it("warns against the sub-agent background-job anti-patterns", () => {
    expect(body).toMatch(/run_in_background.*true/);
    expect(body).toMatch(/cmd\s*&\s*\)/);
    expect(body).toMatch(/SIGKILL|silently/i);
  });

  it("requires a 10-minute Bash timeout on the dispatch call", () => {
    expect(body).toMatch(/600000|10[\s-]minute/);
  });

  it("explicitly rejects synthesis (the differentiator from /brainstorm)", () => {
    expect(body).toMatch(/verbatim|do NOT paraphrase|do not adjudicate|stay neutral/i);
  });

  it("uses the dist/ runner binaries (not raw provider CLIs)", () => {
    expect(body).toMatch(/dist\/run\.js/);
    expect(body).toMatch(/dist\/codex-run\.js/);
    expect(body).toMatch(/dist\/ollama-run\.js/);
  });
});

describe("brainstorm-coordinator agent", () => {
  const content = readFile("agents/brainstorm-coordinator.md");
  const { frontmatter, body } = parseMarkdownFrontmatter(content);

  it("runs on opus (model is the strongest available)", () => {
    expect(frontmatter.model).toBe("opus");
  });

  it("has all three external provider MCP tools", () => {
    const tools = frontmatter.tools as string[];
    expect(tools).toContain("mcp__gemini__ask-gemini");
    expect(tools).toContain("mcp__codex__ask-codex");
    expect(tools).toContain("mcp__ollama__ask-ollama");
  });

  it("has WebFetch and WebSearch (Phase 3B research surface — ADR-049)", () => {
    const tools = frontmatter.tools as string[];
    expect(tools).toContain("WebFetch");
    expect(tools).toContain("WebSearch");
  });

  it("documents the sub-agent background-job lifecycle constraint (ADR-050)", () => {
    expect(body).toMatch(/background.{0,30}job/i);
    expect(body).toMatch(/sub-agent|subagent/i);
  });

  it("requires Phase 3B (Claude research) to run before Phase 3A (external dispatch) — ADR-049", () => {
    expect(body).toMatch(/Phase 3B/);
    expect(body).toMatch(/Phase 3A/);
    expect(body).toMatch(/sequential|before|first/i);
  });

  it("warns against the (cmd &) subshell anti-pattern from ADR-050", () => {
    expect(body).toMatch(/blocking|foreground|wait/i);
  });
});
