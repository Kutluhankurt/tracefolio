import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import { sanitizeRemoteUrl, TracefolioError } from "@tracefolio/core";

const exec = promisify(execFile);

export interface GitFileChange {
  path: string;
  additions: number;
  deletions: number;
  binary: boolean;
}

export interface GitCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  body: string;
  files: GitFileChange[];
}

export interface RepoInfo {
  root: string;
  name: string;
  /** Web URL of the origin remote, with any credentials removed. */
  remoteUrl?: string;
  userEmail?: string;
  userName?: string;
}

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", ["-C", cwd, ...args], { maxBuffer: 256 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === "ENOENT") throw new TracefolioError("git is not installed or not on PATH");
    throw new TracefolioError(`git ${args[0]} failed in ${cwd}: ${(e.stderr ?? e.message).trim()}`);
  }
}

async function gitOptional(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const out = (await git(cwd, args)).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export async function getRepoInfo(path: string): Promise<RepoInfo> {
  const root = (await git(path, ["rev-parse", "--show-toplevel"])).trim();
  const remote = await gitOptional(root, ["remote", "get-url", "origin"]);
  return {
    root,
    name: basename(root),
    remoteUrl: remote ? sanitizeRemoteUrl(remote) : undefined,
    userEmail: await gitOptional(root, ["config", "user.email"]),
    userName: await gitOptional(root, ["config", "user.name"]),
  };
}

const RS = "\x1e";
const US = "\x1f";

export function parseGitLog(output: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const record of output.split(RS)) {
    if (!record.trim()) continue;
    const parts = record.split(US);
    if (parts.length < 7) continue;
    const [hash, authorName, authorEmail, date, subject, body, numstat] = parts as [
      string, string, string, string, string, string, string,
    ];
    const files: GitFileChange[] = [];
    for (const line of numstat.split("\n")) {
      const m = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(line.trim());
      if (!m) continue;
      const binary = m[1] === "-";
      files.push({
        path: renamedPath(m[3]!),
        additions: binary ? 0 : Number(m[1]),
        deletions: binary ? 0 : Number(m[2]),
        binary,
      });
    }
    commits.push({ hash: hash.trim(), authorName, authorEmail, date, subject, body: body.trim(), files });
  }
  return commits;
}

/** numstat renders renames as `dir/{old => new}/file` or `old => new`; keep the new path. */
function renamedPath(path: string): string {
  const braces = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(path);
  if (braces) return `${braces[1]}${braces[3]}${braces[4]}`.replace(/\/\//g, "/");
  const plain = /^(.*) => (.*)$/.exec(path);
  return plain ? plain[2]! : path;
}

export interface ReadCommitsOptions {
  since?: string;
  until?: string;
  maxCount?: number;
}

export async function readCommits(repoPath: string, options: ReadCommitsOptions = {}): Promise<GitCommit[]> {
  const hasHead = await gitOptional(repoPath, ["rev-parse", "--verify", "--quiet", "HEAD"]);
  if (!hasHead) return [];
  const args = [
    "log",
    "--no-merges",
    "--no-color",
    `--format=${RS}%H${US}%an${US}%ae${US}%aI${US}%s${US}%b${US}`,
    "--numstat",
  ];
  if (options.since) args.push(`--since=${options.since}`);
  if (options.until) args.push(`--until=${options.until}`);
  if (options.maxCount) args.push(`--max-count=${options.maxCount}`);
  return parseGitLog(await git(repoPath, args));
}

/** Resolve a (possibly abbreviated) commit to its full hash, date and subject. */
export async function resolveCommit(
  repoPath: string,
  ref: string,
): Promise<{ hash: string; date: string; subject: string } | undefined> {
  const out = await gitOptional(repoPath, ["show", "-s", "--no-color", `--format=%H${US}%aI${US}%s`, "--end-of-options", `${ref}^{commit}`]);
  if (!out) return undefined;
  const [hash, date, subject] = out.split(US) as [string, string, string];
  return { hash, date, subject };
}

export async function isGitRepo(path: string): Promise<boolean> {
  return (await gitOptional(path, ["rev-parse", "--is-inside-work-tree"])) === "true";
}

export async function gitGlobalConfig(key: string): Promise<string | undefined> {
  return gitOptional(process.cwd(), ["config", "--global", key]);
}

export async function gitInit(path: string): Promise<void> {
  await git(path, ["init", "-q"]);
}
