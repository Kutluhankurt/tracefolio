import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CliIO } from "../packages/cli/src/program.js";

export function tempDir(prefix = "tracefolio-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

const gitEnv = (email: string, date?: string): NodeJS.ProcessEnv => ({
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Test User",
  GIT_AUTHOR_EMAIL: email,
  GIT_COMMITTER_NAME: "Test User",
  GIT_COMMITTER_EMAIL: email,
  ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
});

export function git(repo: string, args: string[], env: NodeJS.ProcessEnv = gitEnv("me@example.com")): string {
  return execFileSync("git", ["-C", repo, ...args], { env, encoding: "utf8" });
}

export function makeRepo(name = "sample-repo"): string {
  const repo = join(tempDir(), name);
  mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "me@example.com"]);
  git(repo, ["config", "user.name", "Test User"]);
  return repo;
}

export function commit(
  repo: string,
  files: Record<string, string>,
  message: string,
  options: { email?: string; date?: string } = {},
): string {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
    git(repo, ["add", "-f", path]);
  }
  git(repo, ["commit", "-q", "--allow-empty", "-m", message], gitEnv(options.email ?? "me@example.com", options.date));
  return git(repo, ["rev-parse", "HEAD"]).trim();
}

export interface CapturedIO extends CliIO {
  stdout: string[];
  stderr: string[];
}

export function captureIO(cwd: string): CapturedIO {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (t) => stdout.push(t),
    err: (t) => stderr.push(t),
    cwd,
    env: { ...process.env, TRACEFOLIO_HOME: "" },
  };
}
