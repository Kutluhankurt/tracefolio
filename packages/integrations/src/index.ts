import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const INTEGRATIONS = ["claude-code", "codex"] as const;
export type Integration = (typeof INTEGRATIONS)[number];

/** The canonical skill sources live in the repository's top-level skills/ folder. */
export function skillsSourceDir(): string {
  return fileURLToPath(new URL("../../../skills/", import.meta.url));
}

export interface Skill {
  name: string;
  description: string;
  /** Source folder name, e.g. "capture-work". */
  folder: string;
  content: string;
  body: string;
}

export async function loadSkills(dir = skillsSourceDir()): Promise<Skill[]> {
  if (!existsSync(dir)) throw new Error(`Skills folder not found at ${dir}`);
  const skills: Skill[] = [];
  for (const folder of (await readdir(dir)).sort()) {
    const file = join(dir, folder, "SKILL.md");
    if (!existsSync(file)) continue;
    const content = await readFile(file, "utf8");
    const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
    if (!fm) throw new Error(`${file} is missing YAML frontmatter`);
    const name = /^name:\s*(.+)$/m.exec(fm[1]!)?.[1]?.trim();
    const description = /^description:\s*(.+)$/m.exec(fm[1]!)?.[1]?.trim();
    if (!name || !description) throw new Error(`${file} needs name and description in frontmatter`);
    skills.push({ name, description, folder, content, body: fm[2]!.trim() });
  }
  return skills;
}

export interface InstallOptions {
  /** Install into the user's global agent config instead of a project. */
  user?: boolean;
  /** Project directory (default: cwd). */
  project?: string;
  home?: string;
}

export interface InstallResult {
  integration: Integration;
  written: string[];
}

export async function install(integration: Integration, options: InstallOptions = {}): Promise<InstallResult> {
  const skills = await loadSkills();
  const home = options.home ?? homedir();
  const base = options.user ? home : resolve(options.project ?? process.cwd());
  if (integration === "claude-code") return installClaudeCode(skills, join(base, ".claude"));
  return installCodex(skills, options.user ? join(base, ".codex", "AGENTS.md") : join(base, "AGENTS.md"));
}

/** Claude Code discovers skills at <root>/.claude/skills/<name>/SKILL.md. */
async function installClaudeCode(skills: Skill[], claudeDir: string): Promise<InstallResult> {
  const written: string[] = [];
  for (const skill of skills) {
    const dir = join(claudeDir, "skills", skill.name);
    await mkdir(dir, { recursive: true });
    const target = join(dir, "SKILL.md");
    await writeFile(target, skill.content, "utf8");
    written.push(target);
  }
  return { integration: "claude-code", written };
}

export const AGENTS_START = "<!-- tracefolio:start -->";
export const AGENTS_END = "<!-- tracefolio:end -->";

export function renderAgentsBlock(skills: Skill[]): string {
  const sections = skills.map(
    (s) => `### ${s.name}\n\n_When to use:_ ${s.description}\n\n${s.body.replace(/^# .*\n+/, "")}`,
  );
  return `${AGENTS_START}
## Tracefolio career record

This environment uses [Tracefolio](https://github.com/Kutluhankurt/tracefolio) to keep an
evidence-backed career record. Follow these workflows when they apply. Use
\`--source codex\` when recording events.

${sections.join("\n\n")}
${AGENTS_END}`;
}

/** Codex reads AGENTS.md; the Tracefolio block is replaced in place on reinstall. */
async function installCodex(skills: Skill[], agentsPath: string): Promise<InstallResult> {
  const block = renderAgentsBlock(skills);
  let content = existsSync(agentsPath) ? await readFile(agentsPath, "utf8") : "";
  const start = content.indexOf(AGENTS_START);
  const end = content.indexOf(AGENTS_END);
  if (start !== -1 && end > start) {
    content = `${content.slice(0, start)}${block}${content.slice(end + AGENTS_END.length)}`;
  } else {
    content = content.trim() ? `${content.trimEnd()}\n\n${block}\n` : `${block}\n`;
  }
  await mkdir(resolve(agentsPath, ".."), { recursive: true });
  await writeFile(agentsPath, content, "utf8");
  return { integration: "codex", written: [agentsPath] };
}
