import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Command, Option } from "commander";
import {
  CareerEventSchema,
  EVENT_SOURCES,
  EVENT_TYPES,
  ProfileSchema,
  ProjectSchema,
  ProfileStore,
  RECORD_STATUSES,
  TracefolioError,
  commitKey,
  newEventId,
  nowIso,
  redactSecrets,
  referencedCommits,
  resolveHome,
  type CareerEvent,
  type CareerEventInput,
  type Evidence,
  type Profile,
  type RecordStatus,
} from "@tracefolio/core";
import {
  analyzeRepository,
  getRepoInfo,
  gitGlobalConfig,
  gitInit,
  isGitRepo,
  projectSlug,
  resolveCommit,
  type GroupBy,
} from "@tracefolio/git-adapter";
import {
  buildCareerModel,
  checkAts,
  renderPortfolio,
  renderResumeHtml,
  renderResumeMarkdown,
} from "@tracefolio/generators";
import { INTEGRATIONS, install, type Integration } from "@tracefolio/integrations";
import { serveStatic } from "./serve.js";

export const VERSION = "0.1.0";

export interface CliIO {
  out: (text: string) => void;
  err: (text: string) => void;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Present when an interactive terminal is available. */
  interactive?: { input: NodeJS.ReadableStream; output: NodeJS.WritableStream };
}

export function defaultIO(): CliIO {
  return {
    out: (t) => process.stdout.write(`${t}\n`),
    err: (t) => process.stderr.write(`${t}\n`),
    cwd: process.cwd(),
    env: process.env,
    interactive: process.stdin.isTTY ? { input: process.stdin, output: process.stdout } : undefined,
  };
}

const collect = (value: string, previous: string[] = []) => [...previous, value];
const csv = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function storeFor(cmd: Command, io: CliIO): ProfileStore {
  const { home } = cmd.optsWithGlobals<{ home?: string }>();
  return new ProfileStore(resolveHome({ home, cwd: io.cwd, env: io.env }));
}

function ensureProject(profile: Profile, slug: string, init: { name?: string; repository?: string } = {}): boolean {
  if (profile.projects.some((p) => p.id === slug)) return false;
  profile.projects.push(
    ProjectSchema.parse({
      id: slug,
      name: init.name ?? slug,
      repository: init.repository,
      visibility: "private",
    }),
  );
  return true;
}

function describe(event: CareerEvent): string {
  const commits = event.evidence.filter((e) => e.type === "git_commit").length;
  const other = event.evidence.length - commits;
  const ev = [commits ? `${commits} commit${commits === 1 ? "" : "s"}` : "", other ? `${other} other` : ""]
    .filter(Boolean)
    .join(", ");
  return [
    `${event.id}  [${event.status}]  ${event.title}`,
    `  project: ${event.project ?? "-"} · source: ${event.source} · evidence: ${ev || "none"}`,
    event.skills.length ? `  skills: ${event.skills.join(", ")}` : "",
    event.impact.metric ? `  impact: ${event.impact.metric} (${event.impact.verified ? "verified" : "UNVERIFIED"})` : "",
    ...event.summary
      .split("\n")
      .filter(Boolean)
      .map((l) => `  ${l}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function createProgram(io: CliIO = defaultIO()): Command {
  const program = new Command();
  program
    .name("tracefolio")
    .description("Turn real, evidence-backed work into a living resume and portfolio.")
    .version(VERSION)
    .option("--home <dir>", "Tracefolio home (default: $TRACEFOLIO_HOME, nearest tracefolio.config.json, or ~/.tracefolio)")
    .configureOutput({ writeOut: (s) => io.out(s.trimEnd()), writeErr: (s) => io.err(s.trimEnd()) })
    .showHelpAfterError();

  // init ---------------------------------------------------------------------
  program
    .command("init")
    .description("create a career profile and its configuration")
    .option("--name <name>", "your full name (default: git config user.name)")
    .option("--email <email>", "contact email (default: git config user.email)")
    .option("--headline <text>", "one-line professional headline")
    .option("--git-email <email>", "an email your commits use (repeatable)", collect)
    .option("--no-git", "do not initialise a git repository for the profile")
    .option("--force", "overwrite an existing profile")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const name = opts.name ?? (await gitGlobalConfig("user.name")) ?? "";
      const gitEmail = await gitGlobalConfig("user.email");
      const email = opts.email ?? gitEmail;
      const gitEmails = [...new Set([...(opts.gitEmail ?? []), ...(gitEmail ? [gitEmail] : [])])];
      await mkdir(store.home, { recursive: true });
      await store.init(
        {
          person: { name, headline: opts.headline ?? "", summary: "", email: email || undefined, links: [] },
          identities: { gitEmails },
        },
        { force: opts.force },
      );
      if (opts.git && !(await isGitRepo(store.home))) await gitInit(store.home);
      io.out(`Created Tracefolio profile at ${store.home}`);
      io.out(`  profile: ${store.profilePath}`);
      io.out(`  events:  ${store.eventsPath}`);
      io.out("Next: `tracefolio analyze <repo>` to draft events from your commits.");
    });

  // analyze ------------------------------------------------------------------
  program
    .command("analyze")
    .description("scan git repositories and save your new commits as draft career events")
    .argument("[repos...]", "repository paths", ["."])
    .option("--author <email>", "commit author email that is you (repeatable)", collect)
    .option("--since <date>", 'only commits after this date, e.g. "6 months ago" or 2026-01-01')
    .option("--until <date>", "only commits before this date")
    .addOption(new Option("--group-by <mode>", "how commits become events").choices(["commit", "day", "week"]))
    .option("--dry-run", "show drafts without saving them")
    .action(async (repos: string[], opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const [profile, events, config] = [await store.readProfile(), await store.readEvents(), await store.readConfig()];
      const known = referencedCommits(events);
      const authors: string[] | undefined = opts.author ?? (profile.identities.gitEmails.length ? profile.identities.gitEmails : undefined);
      let total = 0;
      let profileChanged = false;
      for (const repoArg of repos) {
        const repoPath = resolve(io.cwd, repoArg);
        const result = await analyzeRepository(repoPath, {
          authors,
          since: opts.since,
          until: opts.until,
          groupBy: (opts.groupBy as GroupBy | undefined) ?? config.analyze.groupBy,
          maxCommits: config.analyze.maxCommits,
          known,
          sensitivePatterns: config.privacy.sensitivePatterns,
          redact: config.privacy.redactSecrets,
        });
        const { stats } = result;
        io.out(
          `${result.repo.name}: ${stats.scanned} commits scanned, ${stats.authored} yours, ` +
            `${stats.duplicates} already recorded, ${stats.sensitiveOnly} skipped as sensitive → ${result.drafts.length} draft event(s)`,
        );
        if (opts.dryRun) {
          for (const d of result.drafts) io.out(describe(CareerEventSchema.parse(d)));
          continue;
        }
        await store.appendEvents(result.drafts);
        for (const d of result.drafts) {
          for (const e of d.evidence ?? []) if (e.type === "git_commit") known.add(commitKey(e.commit));
        }
        if (result.drafts.length && ensureProject(profile, projectSlug(result.repo.name), { name: result.repo.name, repository: result.repo.remoteUrl })) {
          profileChanged = true;
          io.out(`  added project "${projectSlug(result.repo.name)}" to profile.json (private until you change it)`);
        }
        total += result.drafts.length;
      }
      if (profileChanged) await store.writeProfile(profile);
      if (!opts.dryRun) io.out(total ? `Saved ${total} draft(s). Review them with \`tracefolio review\`.` : "Nothing new to record.");
    });

  // update -------------------------------------------------------------------
  program
    .command("update")
    .description("record a draft career event (used by people and AI agents)")
    .option("--title <text>", "what was achieved")
    .option("--summary <text>", "problem, approach and result in 1-3 sentences")
    .option("--skills <list>", "comma-separated skills", csv)
    .option("--project <slug>", "project id this work belongs to")
    .addOption(new Option("--type <type>", "event type").choices([...EVENT_TYPES]).default("project_contribution"))
    .addOption(new Option("--source <source>", "who recorded it").choices([...EVENT_SOURCES]).default("manual"))
    .option("--repo <path|name>", "repository the --commit hashes belong to (default: current directory)")
    .option("--commit <hash>", "commit evidence (repeatable)", collect)
    .option("--url <url>", "link evidence, e.g. a PR (repeatable)", collect)
    .option("--file <path>", "file evidence (repeatable)", collect)
    .option("--note <text>", "free-text evidence (repeatable)", collect)
    .option("--metric <text>", "a measured outcome; stored as unverified")
    .option("--json <file>", "read event(s) as JSON from a file, or - for stdin")
    .option("--allow-duplicate", "record even if a commit is already referenced")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const [profile, events] = [await store.readProfile(), await store.readEvents()];
      let inputs: Array<Record<string, unknown>>;
      if (opts.json) {
        const text = opts.json === "-" ? await readStdin() : await readFile(resolve(io.cwd, opts.json), "utf8");
        const parsed: unknown = JSON.parse(text);
        inputs = (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>;
      } else {
        if (!opts.title) throw new TracefolioError("--title is required (or use --json)");
        const evidence: Evidence[] = [];
        if (opts.commit?.length) {
          const repoArg: string = opts.repo ?? ".";
          const repoPath = resolve(io.cwd, repoArg);
          const repoIsLocal = existsSync(repoPath) && (await isGitRepo(repoPath));
          const repoName = repoIsLocal ? (await getRepoInfo(repoPath)).name : repoArg;
          for (const ref of opts.commit as string[]) {
            const resolved = repoIsLocal ? await resolveCommit(repoPath, ref) : undefined;
            if (repoIsLocal && !resolved) throw new TracefolioError(`Commit ${ref} not found in ${repoPath}`);
            evidence.push({
              type: "git_commit",
              repository: repoName,
              commit: resolved?.hash ?? ref.toLowerCase(),
              date: resolved?.date,
              subject: resolved ? redactSecrets(resolved.subject) : undefined,
            });
          }
          if (!opts.project) opts.project = projectSlug(repoName);
        }
        for (const url of opts.url ?? []) evidence.push({ type: "url", url });
        for (const path of opts.file ?? []) evidence.push({ type: "file", path });
        for (const text of opts.note ?? []) evidence.push({ type: "note", text: redactSecrets(text) });
        inputs = [
          {
            type: opts.type,
            title: redactSecrets(opts.title),
            summary: redactSecrets(opts.summary ?? ""),
            skills: opts.skills ?? [],
            project: opts.project,
            evidence,
            impact: { metric: opts.metric ?? null, verified: false },
            source: opts.source,
          },
        ];
      }

      const known = referencedCommits(events);
      const toSave: CareerEventInput[] = [];
      for (const input of inputs) {
        if (input.status && input.status !== "draft") io.err(`note: status "${String(input.status)}" ignored; new events are always drafts`);
        const impact = (input.impact ?? {}) as { metric?: string | null };
        const event = CareerEventSchema.parse({
          ...input,
          id: newEventId(),
          status: "draft",
          impact: { metric: impact.metric ?? null, verified: false },
          createdAt: nowIso(),
          updatedAt: undefined,
        });
        const dupes = event.evidence.filter(
          (e) => e.type === "git_commit" && known.has(commitKey(e.commit)),
        );
        if (dupes.length && !opts.allowDuplicate) {
          throw new TracefolioError(
            `Commit(s) already recorded: ${dupes.map((d) => (d.type === "git_commit" ? d.commit.slice(0, 7) : "")).join(", ")}. ` +
              "The work is already captured; use --allow-duplicate to record it anyway.",
          );
        }
        for (const e of event.evidence) if (e.type === "git_commit") known.add(commitKey(e.commit));
        toSave.push(event);
      }
      const saved = await store.appendEvents(toSave);
      let profileChanged = false;
      for (const e of saved) if (e.project && ensureProject(profile, e.project)) profileChanged = true;
      if (profileChanged) await store.writeProfile(profile);
      for (const e of saved) io.out(`Recorded draft ${e.id}: ${e.title}`);
      io.out("Approve with `tracefolio review`.");
    });

  // review -------------------------------------------------------------------
  program
    .command("review")
    .description("review drafts interactively, or edit one record by id")
    .argument("[id]", "event id (or unique prefix) to edit")
    .option("--list", "list records instead of reviewing")
    .addOption(new Option("--filter <status>", "with --list: only this status").choices([...RECORD_STATUSES, "all"]))
    .option("--json", "with --list: print JSON")
    .addOption(new Option("--status <status>", "set status").choices([...RECORD_STATUSES]))
    .option("--title <text>", "set title")
    .option("--summary <text>", "set summary")
    .option("--skills <list>", "replace skills (comma-separated)", csv)
    .option("--project <slug>", "set project")
    .option("--metric <text>", "set the impact metric (unverified)")
    .option("--impact-verified", "confirm the impact metric is backed by the evidence")
    .action(async (id: string | undefined, opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      if (opts.list || (!id && !io.interactive)) {
        const events = await store.readEvents();
        const filter: string = opts.filter ?? (opts.list ? "all" : "draft");
        const shown = filter === "all" ? events : events.filter((e) => e.status === filter);
        if (opts.json) io.out(JSON.stringify(shown, null, 2));
        else if (shown.length === 0) io.out(filter === "all" ? "No records yet." : `No ${filter} records.`);
        else io.out(shown.map(describe).join("\n\n"));
        if (!opts.list && !id) io.out("\n(non-interactive terminal: use `tracefolio review <id> --status reviewed`)");
        return;
      }
      if (id) {
        const updated = await store.updateEvent(id, (e) => ({
          ...e,
          status: (opts.status as RecordStatus | undefined) ?? e.status,
          title: opts.title ?? e.title,
          summary: opts.summary ?? e.summary,
          skills: opts.skills ?? e.skills,
          project: opts.project ?? e.project,
          impact: {
            metric: opts.metric ?? e.impact.metric,
            verified: opts.impactVerified ? true : opts.metric !== undefined ? false : e.impact.verified,
          },
        }));
        if (updated.project) {
          const profile = await store.readProfile();
          if (ensureProject(profile, updated.project)) await store.writeProfile(profile);
        }
        io.out(describe(updated));
        return;
      }
      await interactiveReview(store, io);
    });

  // status -------------------------------------------------------------------
  program
    .command("status")
    .description("show where the profile lives and how many records are in each state")
    .action(async (_opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const [profile, events] = [await store.readProfile(), await store.readEvents()];
      io.out(`Home: ${store.home}`);
      io.out(`Profile: ${profile.person.name || "(no name)"} · ${profile.projects.length} project(s)`);
      for (const s of RECORD_STATUSES) io.out(`  ${s.padEnd(10)} ${events.filter((e) => e.status === s).length}`);
      io.out(`  ${"total".padEnd(10)} ${events.length}`);
    });

  // validate -----------------------------------------------------------------
  program
    .command("validate")
    .description("check profile.json, events.jsonl and the config against the schema")
    .action(async (_opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      await store.readConfig();
      const profile = await store.readProfile();
      const events = await store.readEvents();
      const ids = new Set(profile.projects.map((p) => p.id));
      const orphans = events.filter((e) => e.project && !ids.has(e.project));
      io.out(`OK: profile and ${events.length} event(s) are valid.`);
      if (orphans.length) io.out(`note: ${orphans.length} event(s) reference projects missing from profile.json`);
    });

  // project ------------------------------------------------------------------
  const project = program.command("project").description("manage projects in profile.json");
  project
    .command("add")
    .description("add or update a project")
    .argument("<id>", "project slug")
    .option("--name <name>")
    .option("--description <text>")
    .option("--url <url>", "live site or demo")
    .option("--repository <url>", "public source URL")
    .option("--public", "allow repository and commit links on the portfolio")
    .option("--private", "hide repository and commit links on the portfolio")
    .option("--featured", "feature on the portfolio home page")
    .option("--no-featured", "stop featuring")
    .action(async (id: string, opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const profile = await store.readProfile();
      const existing = profile.projects.find((p) => p.id === id);
      const next = ProjectSchema.parse({
        ...existing,
        id,
        name: opts.name ?? existing?.name ?? id,
        description: opts.description ?? existing?.description,
        url: opts.url ?? existing?.url,
        repository: opts.repository ?? existing?.repository,
        visibility: opts.public ? "public" : opts.private ? "private" : existing?.visibility,
        featured: opts.featured ?? existing?.featured,
      });
      profile.projects = existing ? profile.projects.map((p) => (p.id === id ? next : p)) : [...profile.projects, next];
      await store.writeProfile(profile);
      io.out(`${existing ? "Updated" : "Added"} project ${id} (${next.visibility}${next.featured ? ", featured" : ""})`);
    });
  project
    .command("list")
    .description("list projects")
    .action(async (_opts, cmd: Command) => {
      const profile = await storeFor(cmd, io).readProfile();
      if (!profile.projects.length) io.out("No projects yet.");
      for (const p of profile.projects) io.out(`${p.id.padEnd(24)} ${p.visibility.padEnd(8)} ${p.featured ? "★ " : "  "}${p.name}`);
    });

  // build --------------------------------------------------------------------
  program
    .command("build")
    .description("generate the resume and portfolio from approved records")
    .addOption(
      new Option("--format <format>", "what to build").choices(["markdown", "html", "pdf", "portfolio", "json", "all"]).default("all"),
    )
    .option("--out <dir>", "output directory (default: <home>/out)")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const outDir = opts.out ? resolve(io.cwd, opts.out) : store.outDir;
      if (opts.format === "pdf") {
        throw new TracefolioError(
          "Direct PDF output is not available yet. Run `tracefolio build --format html` and print out/resume.html to PDF from your browser.",
        );
      }
      const written = await buildOutputs(store, outDir, opts.format, io);
      for (const f of written) io.out(`wrote ${f}`);
    });

  // portfolio ----------------------------------------------------------------
  const portfolio = program.command("portfolio").description("build or preview the static portfolio");
  portfolio
    .command("build")
    .description("generate the static portfolio site")
    .option("--out <dir>", "output directory (default: <home>/out)")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      const written = await buildOutputs(store, opts.out ? resolve(io.cwd, opts.out) : store.outDir, "portfolio", io);
      io.out(`wrote ${written.length} files to ${join(opts.out ? resolve(io.cwd, opts.out) : store.outDir, "portfolio")}`);
    });
  portfolio
    .command("dev")
    .description("build the portfolio and serve it on localhost")
    .option("--port <port>", "port", "4321")
    .action(async (opts, cmd: Command) => {
      const store = storeFor(cmd, io);
      await buildOutputs(store, store.outDir, "portfolio", io);
      const port = Number(opts.port);
      await serveStatic(join(store.outDir, "portfolio"), port);
      io.out(`Portfolio preview: http://127.0.0.1:${port}/  (Ctrl+C to stop; rerun to rebuild)`);
    });

  // integrate ----------------------------------------------------------------
  program
    .command("integrate")
    .description("install Tracefolio skills for an AI coding tool")
    .addArgument(
      new Command().createArgument("<tool>", "integration to install").choices([...INTEGRATIONS]),
    )
    .option("--user", "install globally for your user instead of for one project")
    .option("--project <dir>", "project directory (default: current directory)")
    .action(async (tool: Integration, opts) => {
      const result = await install(tool, { user: opts.user, project: opts.project ? resolve(io.cwd, opts.project) : io.cwd });
      for (const f of result.written) io.out(`wrote ${f}`);
      io.out(
        tool === "claude-code"
          ? "Claude Code will pick up the tracefolio-* skills in new sessions."
          : "Codex reads AGENTS.md; the Tracefolio section is updated in place on reinstall.",
      );
    });

  return program;
}

async function buildOutputs(store: ProfileStore, outDir: string, format: string, io: CliIO): Promise<string[]> {
  const [profile, events] = [await store.readProfile(), await store.readEvents()];
  const written: string[] = [];
  const write = async (path: string, content: string) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    written.push(path);
  };
  const all = format === "all";
  if (all || format === "markdown" || format === "html" || format === "json") {
    const model = buildCareerModel(profile, events, "resume");
    const markdown = renderResumeMarkdown(model);
    if (all || format === "markdown") await write(join(outDir, "resume.md"), markdown);
    if (all || format === "html") await write(join(outDir, "resume.html"), renderResumeHtml(model));
    if (all || format === "json") await write(join(outDir, "resume.json"), `${JSON.stringify(model, null, 2)}\n`);
    for (const issue of checkAts(model, markdown)) io.err(`${issue.level}: ${issue.message}`);
  }
  if (all || format === "portfolio") {
    const model = buildCareerModel(profile, events, "portfolio");
    const dir = join(outDir, "portfolio");
    await rm(dir, { recursive: true, force: true });
    for (const file of renderPortfolio(model)) await write(join(dir, file.path), file.content);
    const published = events.filter((e) => e.status === "published").length;
    if (published === 0) io.err("note: no published records yet; the portfolio shows only your profile and featured projects");
  }
  return written;
}

async function interactiveReview(store: ProfileStore, io: CliIO): Promise<void> {
  const term = io.interactive!;
  const rl = createInterface({ input: term.input, output: term.output });
  try {
    const drafts = (await store.readEvents()).filter((e) => e.status === "draft");
    if (drafts.length === 0) {
      io.out("No drafts to review.");
      return;
    }
    io.out(`${drafts.length} draft(s) to review.\n`);
    const actions: Record<string, RecordStatus> = { a: "reviewed", v: "verified", p: "published", r: "rejected" };
    for (const [index, draft] of drafts.entries()) {
      let event = draft;
      for (;;) {
        io.out(`(${index + 1}/${drafts.length})\n${describe(event)}\n`);
        const answer = (
          await rl.question("[a]pprove  [v]erify  [p]ublish  [e]dit  [r]eject  [s]kip  [q]uit > ")
        ).trim().toLowerCase();
        if (answer === "q") return;
        if (answer === "s" || answer === "") break;
        if (answer === "e") {
          const title = (await rl.question(`title [${event.title}]: `)).trim();
          const summary = (await rl.question("summary (enter keeps current): ")).trim();
          const skills = (await rl.question(`skills [${event.skills.join(", ")}]: `)).trim();
          event = await store.updateEvent(event.id, (e) => ({
            ...e,
            title: title || e.title,
            summary: summary || e.summary,
            skills: skills ? csv(skills) : e.skills,
          }));
          continue;
        }
        const status = actions[answer];
        if (!status) continue;
        if (status === "verified" && event.evidence.length === 0) {
          io.out("This record has no evidence, so it cannot be verified. Approve it instead, or add evidence first.\n");
          continue;
        }
        event = await store.setStatus(event.id, status);
        io.out(`→ ${status}\n`);
        break;
      }
    }
    io.out("Review finished. Build your resume with `tracefolio build`.");
  } finally {
    rl.close();
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Run the CLI and return an exit code instead of exiting, so it can be tested. */
export async function run(argv: string[], io: CliIO = defaultIO()): Promise<number> {
  const program = createProgram(io);
  program.exitOverride();
  for (const sub of program.commands) {
    sub.exitOverride();
    for (const nested of sub.commands) nested.exitOverride();
  }
  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (err) {
    const e = err as { code?: string; exitCode?: number; message?: string };
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      return e.code === "commander.helpDisplayed" || e.code === "commander.version" ? 0 : (e.exitCode ?? 1);
    }
    if (err instanceof TracefolioError) io.err(`error: ${err.message}`);
    else if (err instanceof Error && err.name === "ZodError") io.err(`error: invalid input: ${err.message}`);
    else io.err(`error: ${(err as Error).message ?? String(err)}`);
    return 1;
  }
}
