import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../packages/cli/src/program.js";
import { captureIO, commit, makeRepo, tempDir } from "./helpers.js";

async function cli(home: string, cwd: string, ...args: string[]) {
  const io = captureIO(cwd);
  const code = await run(["--home", home, ...args], io);
  return { code, out: io.stdout.join("\n"), err: io.stderr.join("\n") };
}

function idsFrom(json: string): string[] {
  return (JSON.parse(json) as Array<{ id: string }>).map((e) => e.id);
}

describe("first milestone: init → analyze → review → build", () => {
  it("turns a few commits into an approved Markdown resume", async () => {
    const repo = makeRepo("demo-api");
    commit(repo, { "src/server.ts": "x" }, "Add HTTP server");
    commit(repo, { "src/cache.ts": "y", "tests/cache.test.ts": "z" }, "Cache responses");
    const home = join(tempDir(), "career");

    expect((await cli(home, repo, "init", "--name", "Test User", "--email", "t@example.com", "--git-email", "me@example.com", "--no-git")).code).toBe(0);

    const analyzed = await cli(home, repo, "analyze", ".");
    expect(analyzed.code).toBe(0);
    expect(analyzed.out).toMatch(/2 yours.*1 draft/);

    const again = await cli(home, repo, "analyze", ".");
    expect(again.out).toMatch(/2 already recorded/);

    const [id] = idsFrom((await cli(home, repo, "review", "--list", "--json")).out);
    expect(id).toBeDefined();

    const before = await cli(home, repo, "build", "--format", "markdown");
    expect(before.code).toBe(0);
    expect(readFileSync(join(home, "out", "resume.md"), "utf8")).not.toContain("Cache responses");

    const reviewed = await cli(home, repo, "review", id!, "--title", "Build a cached HTTP API", "--status", "reviewed");
    expect(reviewed.code).toBe(0);

    await cli(home, repo, "build", "--format", "markdown");
    const resume = readFileSync(join(home, "out", "resume.md"), "utf8");
    expect(resume).toContain("# Test User");
    expect(resume).toContain("Build a cached HTTP API");
    expect(resume).toMatch(/TypeScript/);
    expect(resume).toContain("Testing");
  });
});

describe("update", () => {
  it("records drafts with evidence, forces draft status and blocks duplicates", async () => {
    const repo = makeRepo("svc");
    const hash = commit(repo, { "main.go": "package main" }, "Add service");
    const home = join(tempDir(), "career");
    await cli(home, repo, "init", "--no-git");

    const first = await cli(home, repo, "update", "--title", "Ship service", "--commit", hash.slice(0, 7), "--source", "claude-code", "--metric", "2x faster");
    expect(first.code).toBe(0);
    const [event] = JSON.parse((await cli(home, repo, "review", "--list", "--json")).out);
    expect(event).toMatchObject({ status: "draft", source: "claude-code", project: "svc", impact: { metric: "2x faster", verified: false } });
    expect(event.evidence[0].commit).toBe(hash);

    const dup = await cli(home, repo, "update", "--title", "Again", "--commit", hash);
    expect(dup.code).toBe(1);
    expect(dup.err).toMatch(/already recorded/);

    const missing = await cli(home, repo, "update", "--title", "Nope", "--commit", "deadbeef");
    expect(missing.code).toBe(1);

    const verify = await cli(home, repo, "review", event.id, "--status", "verified", "--impact-verified");
    expect(verify.code).toBe(0);
    const noEvidence = await cli(home, repo, "update", "--title", "Talk");
    const talkId = noEvidence.out.match(/evt_[a-z0-9]+/)![0];
    const bad = await cli(home, repo, "review", talkId, "--status", "verified");
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/evidence/);
  });
});

describe("errors and integrations", () => {
  it("explains a missing profile", async () => {
    const res = await cli(join(tempDir(), "none"), tempDir(), "status");
    expect(res.code).toBe(1);
    expect(res.err).toMatch(/tracefolio init/);
  });

  it("installs Claude Code skills and an idempotent Codex AGENTS.md block", async () => {
    const project = tempDir();
    const home = tempDir();
    expect((await cli(home, project, "integrate", "claude-code", "--project", project)).code).toBe(0);
    expect(existsSync(join(project, ".claude/skills/tracefolio-capture-work/SKILL.md"))).toBe(true);

    await cli(home, project, "integrate", "codex", "--project", project);
    await cli(home, project, "integrate", "codex", "--project", project);
    const agents = readFileSync(join(project, "AGENTS.md"), "utf8");
    expect(agents.match(/tracefolio:start/g)).toHaveLength(1);
    expect(agents).toContain("--source codex");
  });

  it("refuses PDF with a clear pointer to the HTML resume", async () => {
    const home = join(tempDir(), "career");
    await cli(home, tempDir(), "init", "--no-git");
    const res = await cli(home, tempDir(), "build", "--format", "pdf");
    expect(res.code).toBe(1);
    expect(res.err).toMatch(/print/);
  });
});
