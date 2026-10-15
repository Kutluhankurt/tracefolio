import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  createSensitivePathMatcher,
  localDay,
  redactSecrets,
  type Activity,
  type ActivitySource,
} from "@tracefolio/core";
import { inferSkills } from "@tracefolio/git-adapter";

/** One parsed signal from a session log. */
export interface SessionEvent {
  at: string;
  kind: "prompt" | "tool";
  text?: string;
  tool?: string;
  file?: string;
  command?: string;
}

export interface ParsedSession {
  source: Extract<ActivitySource, "claude-code" | "codex">;
  sessionId: string;
  cwd?: string;
  headless: boolean;
  events: SessionEvent[];
}

const NOISE_PREFIXES = [
  "<task-notification",
  "<bash-",
  "<command-",
  "<local-command",
  "<system-reminder",
  "<environment_context",
  "<user_instructions",
  "# AGENTS.md",
  "Caveat:",
];

/** Clean a user prompt: drop pasted blobs and tool noise, redact secrets, truncate. */
export function cleanPrompt(raw: string, max = 400): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || NOISE_PREFIXES.some((p) => trimmed.startsWith(p))) return undefined;
  const text = redactSecrets(
    trimmed
      .replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/g, "[pasted text]")
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function textOf(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content.flatMap((part) =>
    part && typeof part === "object" && (part as { type?: string }).type === "text"
      ? [String((part as { text?: unknown }).text ?? "")]
      : part && typeof part === "object" && (part as { type?: string }).type === "input_text"
        ? [String((part as { text?: unknown }).text ?? "")]
        : [],
  );
}

/** Parse a Claude Code transcript (~/.claude/projects/<dir>/<session>.jsonl). */
export function parseClaudeCodeSession(content: string, sessionId: string): ParsedSession {
  const session: ParsedSession = { source: "claude-code", sessionId, headless: false, events: [] };
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let d: Record<string, any>;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    if (d.type !== "user" && d.type !== "assistant") continue;
    if (d.entrypoint === "sdk-cli") session.headless = true;
    if (d.cwd && !session.cwd) session.cwd = d.cwd;
    const at: string | undefined = d.timestamp;
    if (!at || d.isSidechain) continue;
    const content = d.message?.content;
    if (d.type === "user" && !d.isMeta) {
      for (const t of textOf(content)) session.events.push({ at, kind: "prompt", text: t });
    }
    if (d.type === "assistant" && Array.isArray(content)) {
      for (const part of content) {
        if (part?.type !== "tool_use") continue;
        const input = part.input ?? {};
        session.events.push({
          at,
          kind: "tool",
          tool: String(part.name),
          file: typeof input.file_path === "string" && /^(Edit|Write|MultiEdit|NotebookEdit)$/.test(part.name) ? input.file_path : undefined,
          command: typeof input.command === "string" ? input.command : undefined,
        });
      }
    }
  }
  return session;
}

/** Parse a Codex rollout (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl). */
export function parseCodexSession(content: string, fallbackId: string): ParsedSession {
  const session: ParsedSession = { source: "codex", sessionId: fallbackId, headless: false, events: [] };
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let d: Record<string, any>;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const p = d.payload ?? {};
    const at: string | undefined = d.timestamp ?? p.timestamp;
    if (d.type === "session_meta") {
      session.cwd = p.cwd ?? session.cwd;
      session.sessionId = p.id ?? session.sessionId;
      if (p.originator && /exec/i.test(String(p.originator))) session.headless = true;
      continue;
    }
    if (!at) continue;
    if (d.type === "event_msg" && p.type === "user_message" && typeof p.message === "string") {
      session.events.push({ at, kind: "prompt", text: p.message });
    }
    if (d.type === "response_item" && (p.type === "function_call" || p.type === "custom_tool_call")) {
      const args = typeof p.arguments === "string" ? p.arguments : typeof p.input === "string" ? p.input : "";
      const files = [...args.matchAll(/\*\*\* (?:Update|Add) File: ([^\n"\\]+)/g)].map((m) => m[1]!.trim());
      if (files.length === 0) session.events.push({ at, kind: "tool", tool: String(p.name) });
      for (const file of files) session.events.push({ at, kind: "tool", tool: String(p.name), file });
      const cmd = /"command"\s*:\s*\[([^\]]*)\]/.exec(args)?.[1];
      if (cmd) session.events.push({ at, kind: "tool", tool: String(p.name), command: cmd.replace(/"/g, "") });
    }
  }
  // Codex logs user messages twice (response_item + event_msg); event_msg alone is used above.
  return session;
}

const COMMAND_SKILLS: Array<[RegExp, string]> = [
  [/\bdocker(-compose)?\b/, "Docker"],
  [/\bkubectl\b|\bhelm\b/, "Kubernetes"],
  [/\bterraform\b/, "Terraform"],
  [/\bpytest\b|\bvitest\b|\bjest\b|\bgo test\b|\bcargo test\b/, "Testing"],
  [/\bpsql\b|\bpg_dump\b/, "PostgreSQL"],
  [/\bssh\b|\bscp\b|\brsync\b/, "SSH"],
  [/\bgh (pr|run|release|repo)\b/, "GitHub"],
  [/\bplaywright\b/, "Playwright"],
];

export interface ProjectResolver {
  (cwd: string | undefined): Promise<{ name: string; root?: string } | undefined>;
}

const IDLE_GAP_MS = 15 * 60 * 1000;

/** Minutes between consecutive signals, ignoring gaps longer than 15 minutes. */
export function activeMinutes(times: string[]): number {
  const sorted = times.map((t) => Date.parse(t)).filter(Number.isFinite).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]! - sorted[i - 1]!;
    if (gap <= IDLE_GAP_MS) ms += gap;
  }
  return Math.max(1, Math.round(ms / 60000));
}

export interface ToActivityOptions {
  storePrompts: boolean;
  sensitivePatterns?: string[];
  maxPrompts?: number;
}

/** Split a session into one activity per local day. */
export function sessionToActivities(
  session: ParsedSession,
  project: { name: string; root?: string },
  options: ToActivityOptions,
): Activity[] {
  const isSensitive = createSensitivePathMatcher(options.sensitivePatterns);
  const byDay = new Map<string, SessionEvent[]>();
  for (const event of session.events) {
    const day = localDay(event.at);
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const activities: Activity[] = [];
  for (const [date, events] of byDay) {
    const prompts = events.flatMap((e) => (e.kind === "prompt" && e.text ? [cleanPrompt(e.text)] : [])).filter(
      (p): p is string => !!p,
    );
    if (prompts.length === 0 && events.every((e) => e.kind !== "tool")) continue;
    const files = new Set<string>();
    const tools: Record<string, number> = {};
    const skills = new Set<string>();
    for (const e of events) {
      if (e.kind !== "tool" || !e.tool) continue;
      tools[e.tool] = (tools[e.tool] ?? 0) + 1;
      if (e.file) {
        const rel = toProjectPath(e.file, project.root, session.cwd);
        if (rel && !isSensitive(rel)) files.add(rel);
      }
      if (e.command) for (const [re, skill] of COMMAND_SKILLS) if (re.test(e.command)) skills.add(skill);
    }
    for (const s of inferSkills([...files])) skills.add(s);
    const times = events.map((e) => e.at).sort();
    activities.push({
      id: `act_${session.source}_${session.sessionId}_${date}`,
      source: session.source,
      date,
      project: project.name,
      start: new Date(times[0]!).toISOString(),
      end: new Date(times[times.length - 1]!).toISOString(),
      activeMinutes: activeMinutes(times),
      promptCount: prompts.length,
      prompts: options.storePrompts ? prompts.slice(0, options.maxPrompts ?? 30) : [],
      files: [...files].slice(0, 40),
      tools,
      commits: [],
      skills: [...skills].sort(),
    });
  }
  return activities;
}

function toProjectPath(file: string, root: string | undefined, cwd: string | undefined): string | undefined {
  const base = root ?? cwd;
  const abs = isAbsolute(file) ? file : base ? resolve(base, file) : file;
  if (base && (abs === base || abs.startsWith(base + sep))) return relative(base, abs);
  // Files outside the project are kept by name only, never by full path.
  return basename(abs);
}

export interface SessionFile {
  source: "claude-code" | "codex";
  path: string;
  mtimeMs: number;
}

async function walk(dir: string, match: (name: string) => boolean, out: string[] = []): Promise<string[]> {
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, match, out);
    else if (match(entry.name)) out.push(full);
  }
  return out;
}

/** Session logs modified in the last `days` days. */
export async function findSessionFiles(
  options: { claudeCode: boolean; codex: boolean; days: number; home?: string },
): Promise<SessionFile[]> {
  const home = options.home ?? homedir();
  const since = Date.now() - options.days * 24 * 60 * 60 * 1000;
  const files: SessionFile[] = [];
  const collect = async (source: SessionFile["source"], paths: string[]) => {
    for (const path of paths) {
      const s = await stat(path);
      if (s.mtimeMs >= since) files.push({ source, path, mtimeMs: s.mtimeMs });
    }
  };
  if (options.claudeCode) {
    // Top-level transcripts only; subagent transcripts live in nested folders.
    const root = join(home, ".claude", "projects");
    const dirs = existsSync(root) ? await readdir(root, { withFileTypes: true }) : [];
    const paths: string[] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      for (const f of await readdir(join(root, d.name))) if (f.endsWith(".jsonl")) paths.push(join(root, d.name, f));
    }
    await collect("claude-code", paths);
  }
  if (options.codex) {
    await collect("codex", await walk(join(home, ".codex", "sessions"), (n) => n.startsWith("rollout-") && n.endsWith(".jsonl")));
  }
  return files;
}

export async function readSession(file: SessionFile): Promise<ParsedSession> {
  const content = await readFile(file.path, "utf8");
  const id = basename(file.path, ".jsonl");
  return file.source === "claude-code" ? parseClaudeCodeSession(content, id) : parseCodexSession(content, id);
}
