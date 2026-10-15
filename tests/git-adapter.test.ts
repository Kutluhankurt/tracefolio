import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { commitKey } from "@tracefolio/core";
import { analyzeRepository, inferSkills, parseGitLog } from "@tracefolio/git-adapter";
import { commit, makeRepo } from "./helpers.js";

describe("parseGitLog", () => {
  it("parses multi-line bodies, binary files and renames", () => {
    const out =
      "\x1eabc123\x1fA\x1fa@x.com\x1f2026-10-01T10:00:00+03:00\x1fSubject\x1fline1\nline2\x1f\n\n" +
      "3\t1\tsrc/a.ts\n-\t-\tlogo.png\n0\t0\tsrc/{old => new}/b.ts\n";
    const [c] = parseGitLog(out);
    expect(c!.body).toBe("line1\nline2");
    expect(c!.files.map((f) => f.path)).toEqual(["src/a.ts", "logo.png", "src/new/b.ts"]);
    expect(c!.files[1]!.binary).toBe(true);
  });
});

describe("inferSkills", () => {
  it("maps extensions and well-known files", () => {
    expect(inferSkills(["a.ts", "b.py", "Dockerfile", ".github/workflows/ci.yml", "x.test.ts"])).toEqual([
      "Docker",
      "GitHub Actions",
      "Python",
      "Testing",
      "TypeScript",
    ]);
  });
});

describe("analyzeRepository", () => {
  it("drafts only the user's non-sensitive commits and skips known ones", async () => {
    const repo = makeRepo("api");
    const first = commit(repo, { "src/a.ts": "1" }, "Add client", { date: "2026-10-05T10:00:00Z" });
    commit(repo, { ".env": "SECRET=1" }, "env", { date: "2026-10-05T11:00:00Z" });
    commit(repo, { "src/b.ts": "2" }, "Someone else", { email: "other@example.com", date: "2026-10-05T12:00:00Z" });
    commit(repo, { "src/c.py": "3", "keys/server.pem": "x" }, "Add worker token=abc123", { date: "2026-10-14T10:00:00Z" });

    const result = await analyzeRepository(repo, { groupBy: "week" });
    expect(result.stats).toMatchObject({ scanned: 4, authored: 3, sensitiveOnly: 1, used: 2 });
    expect(result.drafts).toHaveLength(2);
    for (const d of result.drafts) {
      expect(d.status).toBe("draft");
      expect(d.impact).toEqual({ metric: null, verified: false });
    }
    const serialized = JSON.stringify(result.drafts);
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("server.pem");
    expect(result.drafts[1]!.skills).toEqual(["Python"]);

    const again = await analyzeRepository(repo, { known: new Set([commitKey(first)]) });
    expect(again.stats.duplicates).toBe(1);
    expect(again.drafts.flatMap((d) => d.evidence ?? [])).toHaveLength(1);
  });

  it("returns nothing for an empty repository", async () => {
    const result = await analyzeRepository(makeRepo());
    expect(result.drafts).toEqual([]);
  });
});

describe("copies of a repository", () => {
  it("does not import the same commit twice from a renamed clone", async () => {
    const original = makeRepo("updater_v1");
    commit(original, { "main.py": "print(1)" }, "Add updater");
    const first = await analyzeRepository(original);
    const known = new Set(first.drafts.flatMap((d) => d.evidence ?? []).flatMap((e) => (e.type === "git_commit" ? [commitKey(e.commit)] : [])));

    const copy = `${original}_copy`;
    execFileSync("git", ["clone", "-q", original, copy]);
    const second = await analyzeRepository(copy, { authors: ["me@example.com"], known });
    expect(second.stats.duplicates).toBe(1);
    expect(second.drafts).toEqual([]);
  });
});
