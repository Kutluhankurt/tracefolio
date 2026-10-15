import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CareerEventSchema,
  ProfileStore,
  createSensitivePathMatcher,
  displayableImpact,
  redactSecrets,
  referencedCommits,
  resolveHome,
  sanitizeRemoteUrl,
  selectEvents,
  type CareerEvent,
} from "@tracefolio/core";
import { tempDir } from "./helpers.js";

const base = {
  id: "evt_test1",
  title: "Did a thing",
  createdAt: "2026-10-01T10:00:00.000Z",
};

function event(overrides: Partial<CareerEvent> = {}): CareerEvent {
  return CareerEventSchema.parse({ ...base, ...overrides });
}

describe("CareerEventSchema", () => {
  it("defaults new records to draft with no impact", () => {
    const e = event();
    expect(e.status).toBe("draft");
    expect(e.impact).toEqual({ metric: null, verified: false });
  });

  it("refuses 'verified' without evidence", () => {
    expect(CareerEventSchema.safeParse({ ...base, status: "verified" }).success).toBe(false);
  });

  it("refuses verified impact without a metric or evidence", () => {
    expect(CareerEventSchema.safeParse({ ...base, impact: { metric: null, verified: true } }).success).toBe(false);
    expect(CareerEventSchema.safeParse({ ...base, impact: { metric: "2x", verified: true } }).success).toBe(false);
  });

  it("rejects malformed commit hashes", () => {
    const bad = { ...base, evidence: [{ type: "git_commit", repository: "r", commit: "not-a-hash" }] };
    expect(CareerEventSchema.safeParse(bad).success).toBe(false);
  });
});

describe("selection rules", () => {
  const events = [
    event({ id: "evt_a", status: "draft" }),
    event({ id: "evt_b", status: "reviewed" }),
    event({ id: "evt_c", status: "published" }),
    event({ id: "evt_d", status: "rejected" }),
  ];

  it("resumes include only approved records", () => {
    expect(selectEvents(events, "resume").map((e) => e.id).sort()).toEqual(["evt_b", "evt_c"]);
  });

  it("portfolios include only published records", () => {
    expect(selectEvents(events, "portfolio").map((e) => e.id)).toEqual(["evt_c"]);
  });

  it("never displays unverified metrics", () => {
    expect(displayableImpact(event({ impact: { metric: "10x faster", verified: false } }))).toBeNull();
  });
});

describe("privacy", () => {
  const sensitive = createSensitivePathMatcher(["internal/**"]);

  it.each([".env", "config/.env.production", "certs/server.pem", "deploy/id_rsa", "secrets/db.yaml", "internal/a/b.ts"])(
    "treats %s as sensitive",
    (p) => expect(sensitive(p)).toBe(true),
  );

  it.each(["src/index.ts", "README.md", "environment.ts", "keyboard.ts"])("allows %s", (p) =>
    expect(sensitive(p)).toBe(false),
  );

  it("redacts tokens and key=value secrets", () => {
    const text = redactSecrets("fix ghp_abcdefghijklmnopqrstuvwxyz123456 and password=hunter2 via https://user:pw@host/x");
    expect(text).not.toMatch(/ghp_|hunter2|user:pw/);
    expect(text).toContain("password=[REDACTED]");
  });

  it("strips credentials from remotes", () => {
    expect(sanitizeRemoteUrl("https://x-token:abc@github.com/acme/app.git")).toBe("https://github.com/acme/app");
    expect(sanitizeRemoteUrl("git@github.com:acme/app.git")).toBe("https://github.com/acme/app");
    expect(sanitizeRemoteUrl("/local/path")).toBeUndefined();
  });
});

describe("ProfileStore", () => {
  it("round-trips events and rejects corrupt lines with a line number", async () => {
    const store = new ProfileStore(tempDir());
    await store.init({ person: { name: "T" } });
    await store.appendEvents([{ ...base }]);
    expect((await store.readEvents()).map((e) => e.id)).toEqual(["evt_test1"]);
    await expect(store.appendEvents([{ ...base }])).rejects.toThrow(/Duplicate event id/);

    writeFileSync(store.eventsPath, `${JSON.stringify(base)}\n{oops\n`);
    await expect(store.readEvents()).rejects.toThrow(/line 2/);
  });

  it("updates by unique id prefix", async () => {
    const store = new ProfileStore(tempDir());
    await store.init({ person: {} });
    await store.appendEvents([{ ...base, id: "evt_abc111" }, { ...base, id: "evt_abd222" }]);
    expect((await store.setStatus("evt_abc", "reviewed")).status).toBe("reviewed");
    await expect(store.setStatus("evt_ab", "reviewed")).rejects.toThrow(/ambiguous/);
  });

  it("tracks referenced commits for de-duplication", () => {
    const keys = referencedCommits([
      event({ evidence: [{ type: "git_commit", repository: "Repo", commit: "abcdef1234567890" }] }),
    ]);
    expect(keys.has("repo@abcdef123456")).toBe(true);
  });

  it("resolves home from flag, env, nearest config, then default", () => {
    const dir = tempDir();
    mkdirSync(join(dir, "a", "b"), { recursive: true });
    writeFileSync(join(dir, "tracefolio.config.json"), "{}");
    expect(resolveHome({ home: "/x" })).toBe("/x");
    expect(resolveHome({ env: { TRACEFOLIO_HOME: "/y" } })).toBe("/y");
    expect(resolveHome({ cwd: join(dir, "a", "b"), env: {} })).toBe(dir);
  });
});
