import {
  commitKey,
  createSensitivePathMatcher,
  newEventId,
  nowIso,
  redactSecrets,
  type CareerEventInput,
  type GitCommitEvidence,
} from "@tracefolio/core";
import { getRepoInfo, readCommits, type GitCommit, type RepoInfo } from "./git.js";
import { inferSkills } from "./skills.js";

export type GroupBy = "commit" | "day" | "week";

export interface AnalyzeOptions {
  /** Author emails that identify the user. Defaults to the repo's git user.email. */
  authors?: string[];
  since?: string;
  until?: string;
  groupBy?: GroupBy;
  maxCommits?: number;
  /** Keys from `referencedCommits()` — commits already captured are skipped. */
  known?: Set<string>;
  sensitivePatterns?: string[];
  redact?: boolean;
}

export interface AnalyzeResult {
  repo: RepoInfo;
  drafts: CareerEventInput[];
  stats: {
    scanned: number;
    authored: number;
    duplicates: number;
    sensitiveOnly: number;
    used: number;
  };
}

interface CleanCommit {
  commit: GitCommit;
  paths: string[];
  additions: number;
  deletions: number;
}

const MAX_SUMMARY_SUBJECTS = 6;

export async function analyzeRepository(repoPath: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const repo = await getRepoInfo(repoPath);
  const authors = (options.authors?.length ? options.authors : repo.userEmail ? [repo.userEmail] : []).map((a) =>
    a.toLowerCase(),
  );
  if (authors.length === 0) {
    throw new Error(
      "Cannot tell which commits are yours: set git user.email, add identities.gitEmails to profile.json, or pass --author.",
    );
  }
  const isSensitive = createSensitivePathMatcher(options.sensitivePatterns);
  const redact = options.redact === false ? (s: string) => s : redactSecrets;
  const known = options.known ?? new Set<string>();

  const commits = await readCommits(repo.root, {
    since: options.since,
    until: options.until,
    maxCount: options.maxCommits,
  });
  const stats = { scanned: commits.length, authored: 0, duplicates: 0, sensitiveOnly: 0, used: 0 };
  const clean: CleanCommit[] = [];

  for (const commit of commits) {
    if (!authors.includes(commit.authorEmail.toLowerCase())) continue;
    stats.authored++;
    if (known.has(commitKey(repo.name, commit.hash))) {
      stats.duplicates++;
      continue;
    }
    const files = commit.files.filter((f) => !isSensitive(f.path));
    if (commit.files.length > 0 && files.length === 0) {
      stats.sensitiveOnly++;
      continue;
    }
    clean.push({
      commit,
      paths: files.map((f) => f.path),
      additions: files.reduce((n, f) => n + f.additions, 0),
      deletions: files.reduce((n, f) => n + f.deletions, 0),
    });
  }
  stats.used = clean.length;

  const groups = new Map<string, CleanCommit[]>();
  const groupBy = options.groupBy ?? "week";
  for (const c of clean) {
    const key = groupKey(c.commit, groupBy);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const drafts: CareerEventInput[] = [];
  for (const [key, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    items.sort((a, b) => a.commit.date.localeCompare(b.commit.date));
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const subjects = items.map((c) => redact(c.commit.subject));
    const evidence: GitCommitEvidence[] = items.map((c) => ({
      type: "git_commit",
      repository: repo.name,
      commit: c.commit.hash,
      date: c.commit.date,
      subject: redact(c.commit.subject),
      additions: c.additions,
      deletions: c.deletions,
      filesChanged: c.paths.length,
    }));
    const title =
      groupBy === "commit"
        ? truncate(subjects[0]!, 200)
        : `${repo.name}: ${items.length} commit${items.length === 1 ? "" : "s"} (${groupLabel(key, groupBy)})`;
    const summaryLines = subjects.slice(-MAX_SUMMARY_SUBJECTS).reverse();
    const more = subjects.length - summaryLines.length;
    drafts.push({
      id: newEventId(),
      type: "project_contribution",
      title,
      summary:
        groupBy === "commit"
          ? redact(first.commit.body).slice(0, 4000)
          : [...summaryLines.map((s) => `- ${s}`), ...(more > 0 ? [`- …and ${more} more`] : [])].join("\n"),
      skills: inferSkills(items.flatMap((c) => c.paths)),
      project: projectSlug(repo.name),
      evidence,
      impact: { metric: null, verified: false },
      status: "draft",
      source: "git",
      period: { start: toUtc(first.commit.date), end: toUtc(last.commit.date) },
      createdAt: nowIso(),
    });
  }
  return { repo, drafts, stats };
}

export function projectSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+|-+$/g, "");
  return slug || "project";
}

function toUtc(date: string): string {
  return new Date(date).toISOString();
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function groupKey(commit: GitCommit, groupBy: GroupBy): string {
  const d = new Date(commit.date);
  if (groupBy === "commit") return `${d.toISOString()}#${commit.hash}`;
  if (groupBy === "day") return d.toISOString().slice(0, 10);
  // ISO week starts on Monday (UTC).
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function groupLabel(key: string, groupBy: GroupBy): string {
  return groupBy === "week" ? `week of ${key}` : key;
}
