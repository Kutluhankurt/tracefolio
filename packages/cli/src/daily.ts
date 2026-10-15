import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { Command, Option } from "commander";
import {
  APPROVED_STATUSES,
  ActivityStore,
  ProfileStore,
  RECORD_STATUSES,
  TracefolioError,
  localDay,
  referencedCommits,
  type Config,
  type Profile,
  type RecordStatus,
} from "@tracefolio/core";
import {
  collectActivity,
  generateInsights,
  langOf,
  profileGaps,
  skillCoverage,
} from "@tracefolio/activity";
import { analyzeRepository, isGitRepo, projectSlug } from "@tracefolio/git-adapter";
import { buildCareerModel, renderDashboard, renderResumeHtml, type DashboardData } from "@tracefolio/generators";
import type { CliIO } from "./program.js";

const exec = promisify(execFile);

export interface DailyHelpers {
  storeFor: (cmd: Command) => ProfileStore;
  buildOutputs: (store: ProfileStore, outDir: string, format: string) => Promise<string[]>;
  ensureProject: (profile: Profile, slug: string, init?: { name?: string; repository?: string }) => boolean;
}

const PRIVATE_DIRS = ["activity/", "insights/", "daily.log"];

/** Raw work signals stay out of the profile's git history so they can never be pushed by accident. */
async function ensurePrivateIgnores(home: string): Promise<void> {
  const path = join(home, ".gitignore");
  const current = existsSync(path) ? await readFile(path, "utf8") : "";
  const missing = PRIVATE_DIRS.filter((d) => !current.split("\n").includes(d));
  if (missing.length) await appendFile(path, `${current.endsWith("\n") || !current ? "" : "\n"}${missing.join("\n")}\n`);
}

function authorsOf(profile: Profile): string[] {
  return profile.identities.gitEmails;
}

export async function buildDashboardData(store: ProfileStore, config: Config): Promise<DashboardData> {
  const activityStore = new ActivityStore(store.home);
  const [profile, events, activities, insights, report] = [
    await store.readProfile(),
    await store.readEvents(),
    await activityStore.readActivities(),
    await activityStore.readInsights(),
    await activityStore.readCareerReport(),
  ];
  const lang = langOf(config.insights.language);
  const approved = events.filter((e) => APPROVED_STATUSES.includes(e.status));
  const since = localDay(new Date(Date.now() - 200 * 24 * 60 * 60 * 1000));
  const recent = activities.filter((a) => a.date >= since);
  return {
    generatedAt: new Date().toISOString(),
    today: localDay(new Date()),
    lang,
    person: { name: profile.person.name, headline: profile.person.headline },
    targetRole: config.insights.targetRole,
    activities: recent,
    insights: insights.filter((i) => i.date >= since),
    report,
    coverage: skillCoverage(approved, recent, lang),
    profileGaps: profileGaps(profile, events, lang),
    events: events.map(({ id, title, summary, status, source, project, skills, createdAt }) => ({
      id, title, summary, status, source, project, skills, createdAt,
    })),
    resumeHtml: renderResumeHtml(buildCareerModel(profile, events, "resume")),
  };
}

async function notify(title: string, body: string): Promise<void> {
  try {
    await exec("notify-send", ["--app-name=Tracefolio", title, body], { timeout: 5000 });
  } catch {
    // Notifications are best-effort.
  }
}

function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  execFile(cmd, [url], () => undefined).unref();
}

async function readBody(req: IncomingMessage, limit = 64 * 1024): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function registerDailyCommands(program: Command, io: CliIO, helpers: DailyHelpers): void {
  const { storeFor, buildOutputs, ensureProject } = helpers;

  // activity enable -----------------------------------------------------------
  const activity = program.command("activity").description("configure which work signals Tracefolio may read");
  activity
    .command("enable")
    .description("opt in to reading local AI session logs and daily insights")
    .option("--no-claude-code", "do not read Claude Code sessions")
    .option("--no-codex", "do not read Codex sessions")
    .option("--no-prompts", "keep counts only, not your prompt text")
    .addOption(new Option("--engine <engine>", "who writes daily insights").choices(["claude", "rules"]))
    .option("--language <lang>", "language for summaries and advice, e.g. tr or en")
    .option("--role <role>", "target role for the gap analysis")
    .option("--model <model>", "model passed to `claude --model`")
    .option("--repo <path>", "also scan this repository for commits (repeatable)", (v: string, p: string[] = []) => [...p, v])
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd);
      store.assertInitialized();
      const config = await store.readConfig();
      config.activity.claudeCode = opts.claudeCode;
      config.activity.codex = opts.codex;
      config.activity.storePrompts = opts.prompts;
      if (opts.repo) config.activity.repos = [...new Set([...config.activity.repos, ...opts.repo.map((r: string) => resolve(io.cwd, r))])];
      if (opts.engine) config.insights.engine = opts.engine;
      if (opts.language) config.insights.language = opts.language;
      if (opts.role) config.insights.targetRole = opts.role;
      if (opts.model) config.insights.model = opts.model;
      await store.writeConfig(config);
      await ensurePrivateIgnores(store.home);
      io.out(`Activity: Claude Code ${config.activity.claudeCode ? "on" : "off"}, Codex ${config.activity.codex ? "on" : "off"}, prompts ${config.activity.storePrompts ? "stored (redacted)" : "not stored"}`);
      io.out(`Insights: ${config.insights.engine}, language ${config.insights.language}, role "${config.insights.targetRole}"`);
      io.out(`Repositories: ${config.activity.repos.length} configured, plus any found through AI sessions`);
    });

  // collect --------------------------------------------------------------------
  program
    .command("collect")
    .description("gather recent AI session and commit activity (local only)")
    .option("--days <n>", "how many days back", "30")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd);
      const [config, profile] = [await store.readConfig(), await store.readProfile()];
      const res = await collectActivity({ home: store.home, config, authors: authorsOf(profile), days: Number(opts.days) });
      io.out(
        `Scanned ${res.sessions.scanned} AI session(s) (${res.sessions.skippedHeadless} headless, ${res.sessions.skippedOutside} outside projects skipped) and ${res.repos.length} repo(s): ${res.added} new, ${res.updated} updated activity record(s).`,
      );
    });

  // insights ---------------------------------------------------------------------
  program
    .command("insights")
    .description("write the daily summary, resume suggestions and career gaps for a day")
    .option("--date <day>", "YYYY-MM-DD (default: today)")
    .addOption(new Option("--engine <engine>", "override the configured engine").choices(["claude", "rules"]))
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd);
      const result = await runInsights(store, opts.date ?? localDay(new Date()), opts.engine, io, ensureProject);
      io.out(result);
    });

  // daily ------------------------------------------------------------------------
  program
    .command("daily")
    .description("collect, summarise, suggest, rebuild and notify: the whole daily routine")
    .option("--days <n>", "how many days of activity to (re)collect", "30")
    .addOption(new Option("--engine <engine>", "override the configured engine").choices(["claude", "rules"]))
    .option("--no-notify", "skip the desktop notification")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd);
      const [config, profile] = [await store.readConfig(), await store.readProfile()];
      await ensurePrivateIgnores(store.home);
      const today = localDay(new Date());
      io.out(`=== Tracefolio daily · ${new Date().toISOString()} ===`);

      const res = await collectActivity({ home: store.home, config, authors: authorsOf(profile), days: Number(opts.days) });
      io.out(`collect: ${res.sessions.scanned} AI sessions, ${res.repos.length} repos → ${res.added} new, ${res.updated} updated`);

      // Back-fill summaries for past days with the free local rules; only today uses the configured engine.
      const activityStore = new ActivityStore(store.home);
      const days = [...new Set((await activityStore.readActivities()).map((a) => a.date))].filter((d) => d < today);
      let backfilled = 0;
      for (const day of days) {
        if (await activityStore.readInsight(day)) continue;
        await runInsights(store, day, "rules", io, ensureProject, { quiet: true });
        backfilled++;
      }
      if (backfilled) io.out(`insights: back-filled ${backfilled} past day(s) with local rules`);
      io.out(await runInsights(store, today, opts.engine, io, ensureProject));

      // Commits from configured repos that no suggestion covered become weekly drafts as before.
      const events = await store.readEvents();
      const known = referencedCommits(events);
      let gitDrafts = 0;
      const prof = await store.readProfile();
      for (const repo of config.activity.repos) {
        if (!existsSync(repo) || !(await isGitRepo(repo))) continue;
        const r = await analyzeRepository(repo, {
          authors: authorsOf(prof),
          since: "14 days ago",
          groupBy: config.analyze.groupBy,
          known,
          sensitivePatterns: config.privacy.sensitivePatterns,
          redact: config.privacy.redactSecrets,
        });
        if (r.drafts.length) {
          await store.appendEvents(r.drafts);
          ensureProject(prof, projectSlug(r.repo.name), { name: r.repo.name, repository: r.repo.remoteUrl });
          gitDrafts += r.drafts.length;
        }
      }
      if (gitDrafts) {
        await store.writeProfile(prof);
        io.out(`analyze: ${gitDrafts} weekly git draft(s)`);
      }

      await buildOutputs(store, store.outDir, "all");
      const dashPath = join(store.outDir, "dashboard", "index.html");
      await mkdir(join(store.outDir, "dashboard"), { recursive: true });
      await writeFile(dashPath, renderDashboard(await buildDashboardData(store, await store.readConfig())), "utf8");
      io.out(`dashboard: ${dashPath}`);

      if (await isGitRepo(store.home)) {
        try {
          await exec("git", ["-C", store.home, "add", "-A"]);
          await exec("git", ["-C", store.home, "commit", "-q", "-m", `tracefolio daily ${today}`]);
        } catch {
          // Nothing to commit.
        }
      }

      const insight = await activityStore.readInsight(today);
      const drafts = (await store.readEvents()).filter((e) => e.status === "draft").length;
      if (opts.notify && config.insights.notify) {
        const tr = langOf(config.insights.language) === "tr";
        await notify(
          tr ? "Tracefolio · günlük özet hazır" : "Tracefolio · daily summary ready",
          `${insight?.summary.slice(0, 180) ?? ""}\n${tr ? `${drafts} taslak onay bekliyor · tracefolio dashboard` : `${drafts} draft(s) waiting · tracefolio dashboard`}`,
        );
      }
    });

  // dashboard ----------------------------------------------------------------------
  program
    .command("dashboard")
    .description("open the career dashboard with working review buttons")
    .option("--port <port>", "port", "4322")
    .option("--no-open", "do not open a browser")
    .option("--build-only", "only write out/dashboard/index.html")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd);
      const config = await store.readConfig();
      if (opts.buildOnly) {
        const path = join(store.outDir, "dashboard", "index.html");
        await mkdir(join(store.outDir, "dashboard"), { recursive: true });
        await writeFile(path, renderDashboard(await buildDashboardData(store, config)), "utf8");
        io.out(`wrote ${path}`);
        return;
      }
      const port = Number(opts.port);
      const token = randomBytes(24).toString("hex");
      const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      const server = createServer(async (req, res) => {
        try {
          if (!allowedHosts.has(req.headers.host ?? "")) {
            res.writeHead(403).end("Forbidden");
            return;
          }
          const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
          if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
            const html = renderDashboard(await buildDashboardData(store, await store.readConfig()), { token });
            res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(html);
            return;
          }
          if (req.method === "POST" && url.pathname === "/api/review") {
            if (req.headers["x-tracefolio-token"] !== token) {
              res.writeHead(403).end("Forbidden");
              return;
            }
            const body = JSON.parse(await readBody(req)) as { id?: string; status?: string };
            if (!body.id || !RECORD_STATUSES.includes(body.status as RecordStatus)) {
              res.writeHead(400).end("Bad request");
              return;
            }
            const updated = await store.setStatus(body.id, body.status as RecordStatus);
            if (updated.project) {
              const profile = await store.readProfile();
              if (ensureProject(profile, updated.project)) await store.writeProfile(profile);
            }
            await buildOutputs(store, store.outDir, "all");
            const profile = await store.readProfile();
            const resumeHtml = renderResumeHtml(buildCareerModel(profile, await store.readEvents(), "resume"));
            res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: updated.status, resumeHtml }));
            return;
          }
          res.writeHead(404).end("Not found");
        } catch (err) {
          res.writeHead(500, { "content-type": "text/plain" }).end((err as Error).message);
        }
      });
      await new Promise<void>((ok, fail) => {
        server.once("error", fail);
        server.listen(port, "127.0.0.1", () => ok());
      });
      const url = `http://127.0.0.1:${port}/`;
      io.out(`Dashboard: ${url}  (Ctrl+C to stop)`);
      if (opts.open) openInBrowser(url);
    });
}

async function runInsights(
  store: ProfileStore,
  date: string,
  engine: "claude" | "rules" | undefined,
  io: CliIO,
  ensureProject: DailyHelpers["ensureProject"],
  options: { quiet?: boolean } = {},
): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TracefolioError("--date must be YYYY-MM-DD");
  const [config, profile, events] = [await store.readConfig(), await store.readProfile(), await store.readEvents()];
  const activityStore = new ActivityStore(store.home);
  const activities = await activityStore.readActivities();
  const result = await generateInsights({ date, profile, events, activities, config }, { home: store.home, engine });
  for (const w of result.warnings) io.err(`warning: ${w}`);
  await activityStore.writeInsight(result.insight);
  // Back-filled days must not overwrite the current career report.
  if (!options.quiet) await activityStore.writeCareerReport(result.report);
  if (result.drafts.length) {
    const saved = await store.appendEvents(result.drafts);
    let changed = false;
    for (const e of saved) if (e.project && ensureProject(profile, e.project)) changed = true;
    if (changed) await store.writeProfile(profile);
  }
  return `insights ${date}: ${result.insight.engine}, ${result.insight.highlights.length} highlight(s), ${result.drafts.length} new draft suggestion(s)`;
}
