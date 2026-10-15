import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ActivityStore, ConfigSchema, ProfileSchema, type Activity } from "@tracefolio/core";
import {
  activeMinutes,
  cleanPrompt,
  collectActivity,
  extractJson,
  generateInsights,
  parseClaudeCodeSession,
  parseCodexSession,
  sessionToActivities,
  skillCoverage,
} from "@tracefolio/activity";
import { renderDashboard, type DashboardData } from "@tracefolio/generators";
import { commit, makeRepo, tempDir } from "./helpers.js";

const line = (o: unknown) => JSON.stringify(o);

function claudeTranscript(cwd: string, opts: { headless?: boolean } = {}): string {
  const base = { cwd, sessionId: "s1", entrypoint: opts.headless ? "sdk-cli" : "cli" };
  return [
    line({ ...base, type: "user", timestamp: "2026-10-14T09:00:00.000Z", message: { role: "user", content: "Add retry with backoff to the uploader, token=abc123" } }),
    line({ ...base, type: "assistant", timestamp: "2026-10-14T09:01:00.000Z", message: { content: [{ type: "tool_use", name: "Edit", input: { file_path: `${cwd}/src/upload.py`, old_string: "a", new_string: "b" } }] } }),
    line({ ...base, type: "assistant", timestamp: "2026-10-14T09:02:00.000Z", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: `${cwd}/.env`, content: "SECRET=1" } }] } }),
    line({ ...base, type: "assistant", timestamp: "2026-10-14T09:03:00.000Z", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "pytest -q" } }] } }),
    line({ ...base, type: "user", timestamp: "2026-10-14T09:03:30.000Z", message: { content: [{ type: "tool_result", content: "ok" }] } }),
    line({ ...base, type: "user", timestamp: "2026-10-14T09:04:00.000Z", message: { content: "<task-notification>done</task-notification>" } }),
    line({ ...base, type: "user", isMeta: true, timestamp: "2026-10-14T09:04:10.000Z", message: { content: "meta caveat" } }),
    line({ ...base, type: "user", timestamp: "2026-10-14T09:05:00.000Z", message: { content: "Here is the log <pasted_content id=\"x\">huge blob</pasted_content id=\"x\"> fix it" } }),
  ].join("\n");
}

describe("session parsing", () => {
  it("keeps the user's own prompts and edited files, drops noise and secrets", () => {
    const session = parseClaudeCodeSession(claudeTranscript("/work/app"), "s1");
    const [activity] = sessionToActivities(session, { name: "app", root: "/work/app" }, { storePrompts: true });
    expect(activity!.prompts).toEqual([
      "Add retry with backoff to the uploader, token=[REDACTED]",
      "Here is the log [pasted text] fix it",
    ]);
    expect(activity!.files).toEqual(["src/upload.py"]);
    expect(activity!.skills).toEqual(["Python", "Testing"]);
    expect(activity!.tools).toMatchObject({ Edit: 1, Write: 1, Bash: 1 });
    expect(activity!.activeMinutes).toBe(5);
  });

  it("keeps only counts when prompt storage is off", () => {
    const session = parseClaudeCodeSession(claudeTranscript("/work/app"), "s1");
    const [activity] = sessionToActivities(session, { name: "app" }, { storePrompts: false });
    expect(activity!.prompts).toEqual([]);
    expect(activity!.promptCount).toBe(2);
  });

  it("marks headless runs", () => {
    expect(parseClaudeCodeSession(claudeTranscript("/w", { headless: true }), "s").headless).toBe(true);
  });

  it("reads Codex user messages and patched files", () => {
    const content = [
      line({ type: "session_meta", timestamp: "2026-10-14T10:00:00Z", payload: { id: "cx1", cwd: "/work/api", timestamp: "2026-10-14T10:00:00Z" } }),
      line({ type: "response_item", timestamp: "2026-10-14T10:00:01Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>x</environment_context>" }] } }),
      line({ type: "event_msg", timestamp: "2026-10-14T10:00:02Z", payload: { type: "user_message", message: "Add pagination to /users" } }),
      line({ type: "response_item", timestamp: "2026-10-14T10:03:00Z", payload: { type: "function_call", name: "apply_patch", arguments: "*** Begin Patch\n*** Update File: src/users.ts\n" } }),
    ].join("\n");
    const session = parseCodexSession(content, "fallback");
    expect(session.sessionId).toBe("cx1");
    const [activity] = sessionToActivities(session, { name: "api", root: "/work/api" }, { storePrompts: true });
    expect(activity!.prompts).toEqual(["Add pagination to /users"]);
    expect(activity!.files).toEqual(["src/users.ts"]);
  });

  it("ignores idle gaps when measuring active time", () => {
    expect(activeMinutes(["2026-10-14T09:00:00Z", "2026-10-14T09:10:00Z", "2026-10-14T13:00:00Z"])).toBe(10);
    expect(cleanPrompt("<bash-input>ls</bash-input>")).toBeUndefined();
  });
});

describe("collectActivity", () => {
  it("collects sessions and the user's commits, skipping headless and Tracefolio-home sessions", async () => {
    const userHome = tempDir();
    const repo = makeRepo("shop");
    commit(repo, { "src/cart.ts": "x" }, "Add cart");
    commit(repo, { "src/x.ts": "y" }, "Not mine", { email: "other@example.com" });
    const home = join(userHome, ".tracefolio");
    const projects = join(userHome, ".claude", "projects", "p");
    mkdirSync(projects, { recursive: true });
    writeFileSync(join(projects, "a.jsonl"), claudeTranscript(repo));
    writeFileSync(join(projects, "b.jsonl"), claudeTranscript(repo, { headless: true }));
    writeFileSync(join(projects, "c.jsonl"), claudeTranscript(home));
    const config = ConfigSchema.parse({ activity: { claudeCode: true, storePrompts: true } });

    const res = await collectActivity({ home, config, authors: ["me@example.com"], days: 3650, userHome });
    expect(res.sessions).toEqual({ scanned: 3, skippedHeadless: 1, skippedOutside: 1 });
    const acts = await new ActivityStore(home).readActivities();
    const git = acts.find((a) => a.source === "git")!;
    expect(git.commits.map((c) => c.subject)).toEqual(["Add cart"]);
    expect(acts.filter((a) => a.source === "claude-code")).toHaveLength(1);

    const again = await collectActivity({ home, config, authors: ["me@example.com"], days: 3650, userHome });
    expect(again.added).toBe(0);
  });
});

const activity = (over: Partial<Activity>): Activity => ({
  id: "act_1",
  source: "claude-code",
  date: "2026-10-14",
  project: "shop",
  start: "2026-10-14T09:00:00.000Z",
  end: "2026-10-14T10:00:00.000Z",
  activeMinutes: 60,
  promptCount: 2,
  prompts: ["Add cart", "Fix tests"],
  files: ["src/cart.ts"],
  tools: {},
  commits: [],
  skills: ["TypeScript", "PostgreSQL"],
  ...over,
});

describe("insights", () => {
  const profile = ProfileSchema.parse({ person: { name: "T" } });

  it("summarises a day with local rules and reports gaps without calling any AI", async () => {
    const config = ConfigSchema.parse({ insights: { engine: "rules", language: "tr" } });
    const out = await generateInsights(
      { date: "2026-10-14", profile, events: [], activities: [activity({})], config },
      { home: tempDir() },
    );
    expect(out.insight.engine).toBe("rules");
    expect(out.insight.summary).toContain("shop");
    expect(out.drafts).toEqual([]);
    expect(out.report.gaps.map((g) => g.area)).toContain("Veritabanları");
  });

  it("classifies skills as on resume, in practice or missing", () => {
    const coverage = skillCoverage([], [activity({})], "en");
    expect(coverage.find((c) => c.key === "data")!.status).toBe("practicing");
    expect(coverage.find((c) => c.key === "security")!.status).toBe("gap");
  });

  it("extracts JSON from fenced or chatty answers", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here: {"b":2} done')).toEqual({ b: 2 });
  });
});

describe("dashboard", () => {
  it("embeds data safely and only enables review buttons with a token", () => {
    const data: DashboardData = {
      generatedAt: "2026-10-14T18:00:00.000Z",
      today: "2026-10-14",
      lang: "tr",
      person: { name: "T", headline: "" },
      targetRole: "AI / Software Engineer",
      activities: [activity({ prompts: ["</script><script>alert(1)</script>"] })],
      insights: [],
      coverage: [],
      profileGaps: [],
      events: [],
      resumeHtml: "<p>cv</p>",
    };
    const html = renderDashboard(data);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).not.toContain("<meta name=\"tf-token\"");
    expect(renderDashboard(data, { token: "abc" })).toContain('name="tf-token" content="abc"');
  });
});
