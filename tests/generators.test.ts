import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ProfileStore } from "@tracefolio/core";
import {
  buildCareerModel,
  checkAts,
  renderPortfolio,
  renderResumeHtml,
  renderResumeMarkdown,
} from "@tracefolio/generators";

const demo = new ProfileStore(fileURLToPath(new URL("../examples/demo", import.meta.url)));

async function load() {
  return { profile: await demo.readProfile(), events: await demo.readEvents() };
}

describe("resume", () => {
  it("includes approved records and verified metrics only", async () => {
    const { profile, events } = await load();
    const md = renderResumeMarkdown(buildCareerModel(profile, events, "resume"));
    expect(md).toContain("# Ada Example");
    expect(md).toContain("Parallel device updates with per-device workers");
    expect(md).toContain("Site rollout time cut"); // verified metric
    expect(md).not.toContain("Peak memory"); // unverified metric
    expect(md).toContain("Completed internal course"); // reviewed, no project
    expect(md).not.toContain("hot reload"); // draft
    expect(md).not.toMatch(/\|.*\|.*\|\n\|[- |]+\|/); // no tables for ATS
  });

  it("escapes HTML in user content", async () => {
    const { profile, events } = await load();
    profile.person.name = "<script>alert(1)</script>";
    const html = renderResumeHtml(buildCareerModel(profile, events, "resume"));
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("reports ATS problems", async () => {
    const { profile } = await load();
    profile.person.email = undefined;
    const model = buildCareerModel(profile, [], "resume");
    expect(checkAts(model, renderResumeMarkdown(model)).map((i) => i.message).join()).toMatch(/email/);
  });
});

describe("portfolio", () => {
  it("shows published records only and hides private evidence", async () => {
    const { profile, events } = await load();
    const files = renderPortfolio(buildCareerModel(profile, events, "portfolio"));
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
    expect(Object.keys(byPath)).toEqual(
      expect.arrayContaining(["index.html", "projects/fleet-updater.html", "projects/log-lens.html", "assets/styles.css"]),
    );
    const all = files.map((f) => f.content).join("\n");
    expect(all).not.toContain("Completed internal course"); // reviewed, not published
    expect(all).not.toContain("Peak memory"); // unverified metric

    const privatePage = byPath["projects/fleet-updater.html"]!;
    expect(privatePage).not.toMatch(/a1b2c3d|b2c3d4e/);
    expect(privatePage).toContain("1 commit in a private repository");

    const publicPage = byPath["projects/log-lens.html"]!;
    expect(publicPage).toContain("https://github.com/example/log-lens/commit/c3d4e5f6");
  });

  it("respects reduced motion and works without JavaScript", async () => {
    const { profile, events } = await load();
    const files = renderPortfolio(buildCareerModel(profile, events, "portfolio"));
    const css = files.find((f) => f.path === "assets/styles.css")!.content;
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toMatch(/\.js \.reveal\{opacity:0/); // hidden only once JS has run
  });
});
