import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import {
  ActivityStore,
  createSensitivePathMatcher,
  localDay,
  redactSecrets,
  type Activity,
  type Config,
} from "@tracefolio/core";
import { getRepoInfo, inferSkills, readCommits } from "@tracefolio/git-adapter";
import { activeMinutes, findSessionFiles, readSession, sessionToActivities } from "./sessions.js";

export interface CollectOptions {
  home: string;
  config: Config;
  authors: string[];
  days: number;
  /** Override for tests: where ~/.claude and ~/.codex live. */
  userHome?: string;
}

export interface CollectResult {
  sessions: { scanned: number; skippedHeadless: number; skippedOutside: number };
  repos: string[];
  activities: number;
  added: number;
  updated: number;
}

const HOME_PROJECT = "(home)";

function within(path: string, dir: string): boolean {
  const p = resolve(path);
  const d = resolve(dir);
  return p === d || p.startsWith(d + sep);
}

async function singleChildRepo(dir: string): Promise<{ name: string; root: string } | undefined> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const repos = entries.filter((e) => e.isDirectory() && existsSync(join(dir, e.name, ".git")));
    if (repos.length !== 1) return undefined;
    const root = join(dir, repos[0]!.name);
    return { name: (await getRepoInfo(root)).name, root };
  } catch {
    return undefined;
  }
}

/** Gather AI session and git activity for the last `days` days into the activity store. */
export async function collectActivity(options: CollectOptions): Promise<CollectResult> {
  const { config } = options;
  const userHome = options.userHome ?? homedir();
  const rootCache = new Map<string, { name: string; root?: string } | undefined>();
  const resolveProject = async (cwd: string | undefined) => {
    if (!cwd) return undefined;
    if (rootCache.has(cwd)) return rootCache.get(cwd);
    let project: { name: string; root?: string } | undefined;
    if (!existsSync(cwd)) project = { name: basename(cwd) || HOME_PROJECT };
    else {
      try {
        const info = await getRepoInfo(cwd);
        project = { name: info.name, root: info.root };
      } catch {
        // A folder that wraps exactly one repository (e.g. ~/Bot/bot-repo) is that project.
        const child = resolve(cwd) === resolve(userHome) ? undefined : await singleChildRepo(cwd);
        project = child ?? { name: resolve(cwd) === resolve(userHome) ? HOME_PROJECT : basename(cwd) };
      }
    }
    rootCache.set(cwd, project);
    return project;
  };

  const activities: Activity[] = [];
  const result: CollectResult = {
    sessions: { scanned: 0, skippedHeadless: 0, skippedOutside: 0 },
    repos: [],
    activities: 0,
    added: 0,
    updated: 0,
  };
  const repoRoots = new Set<string>(config.activity.repos.map((r) => resolve(r.replace(/^~(?=$|\/)/, userHome))));

  const files = await findSessionFiles({
    claudeCode: config.activity.claudeCode,
    codex: config.activity.codex,
    days: options.days,
    home: userHome,
  });
  const cutoff = localDay(new Date(Date.now() - options.days * 24 * 60 * 60 * 1000));
  for (const file of files) {
    const session = await readSession(file);
    result.sessions.scanned++;
    if (session.headless && !config.activity.includeHeadless) {
      result.sessions.skippedHeadless++;
      continue;
    }
    // Sessions inside Tracefolio's own home (its insight runs) are not the user's work.
    if (session.cwd && within(session.cwd, options.home)) {
      result.sessions.skippedOutside++;
      continue;
    }
    const project = await resolveProject(session.cwd);
    if (!project) continue;
    if (project.root) repoRoots.add(project.root);
    activities.push(
      ...sessionToActivities(session, project, {
        storePrompts: config.activity.storePrompts,
        sensitivePatterns: config.privacy.sensitivePatterns,
      }).filter((a) => a.date >= cutoff),
    );
  }

  const authors = options.authors.map((a) => a.toLowerCase());
  const isSensitive = createSensitivePathMatcher(config.privacy.sensitivePatterns);
  for (const root of repoRoots) {
    if (!existsSync(root)) continue;
    let name: string;
    let commits;
    try {
      name = (await getRepoInfo(root)).name;
      commits = await readCommits(root, { since: `${options.days} days ago` });
    } catch {
      continue;
    }
    result.repos.push(root);
    const mine = commits.filter((c) => authors.includes(c.authorEmail.toLowerCase()));
    const byDay = new Map<string, typeof mine>();
    for (const c of mine) byDay.set(localDay(c.date), [...(byDay.get(localDay(c.date)) ?? []), c]);
    for (const [date, list] of byDay) {
      const paths = list.flatMap((c) => c.files.map((f) => f.path)).filter((p) => !isSensitive(p));
      const times = list.map((c) => c.date).sort();
      activities.push({
        id: `act_git_${name}_${date}`,
        source: "git",
        date,
        project: name,
        start: new Date(times[0]!).toISOString(),
        end: new Date(times[times.length - 1]!).toISOString(),
        activeMinutes: list.length > 1 ? activeMinutes(times) : 0,
        promptCount: 0,
        prompts: [],
        files: [...new Set(paths)].slice(0, 40),
        tools: {},
        commits: list.map((c) => ({ hash: c.hash, subject: redactSecrets(c.subject) })),
        skills: inferSkills(paths),
      });
    }
  }

  const store = new ActivityStore(options.home);
  const { added, updated } = await store.upsertActivities(activities);
  result.activities = activities.length;
  result.added = added;
  result.updated = updated;
  return result;
}
