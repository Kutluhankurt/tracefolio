import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import { formatIssues } from "./schema.js";
import { TracefolioError } from "./store.js";

const isoDateTime = z.string().datetime({ offset: true });
export const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const ACTIVITY_SOURCES = ["claude-code", "codex", "git"] as const;
export const ActivitySourceSchema = z.enum(ACTIVITY_SOURCES);
export type ActivitySource = z.infer<typeof ActivitySourceSchema>;

/**
 * What the user did in one tool, in one project, on one local day. Raw work
 * signals only: never shown on a resume or portfolio directly.
 */
export const ActivitySchema = z.object({
  id: z.string().min(1),
  source: ActivitySourceSchema,
  date: DaySchema,
  project: z.string().min(1),
  start: isoDateTime,
  end: isoDateTime,
  activeMinutes: z.number().int().nonnegative(),
  promptCount: z.number().int().nonnegative().default(0),
  /** The user's own requests, redacted and truncated. */
  prompts: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  tools: z.record(z.number().int().nonnegative()).default({}),
  commits: z.array(z.object({ hash: z.string(), subject: z.string() })).default([]),
  skills: z.array(z.string()).default([]),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const SuggestionSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).default(""),
  skills: z.array(z.string()).default([]),
  project: z.string().optional(),
  commits: z.array(z.string()).default([]),
  /** Id of the draft event created from this suggestion, if any. */
  eventId: z.string().optional(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const DailyInsightSchema = z.object({
  date: DaySchema,
  generatedAt: isoDateTime,
  engine: z.enum(["claude", "rules"]),
  summary: z.string(),
  highlights: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  suggestions: z.array(SuggestionSchema).default([]),
});
export type DailyInsight = z.infer<typeof DailyInsightSchema>;

export const CareerReportSchema = z.object({
  generatedAt: isoDateTime,
  engine: z.enum(["claude", "rules"]),
  targetRole: z.string(),
  headline: z.string().optional(),
  strengths: z.array(z.object({ area: z.string(), evidence: z.string() })).default([]),
  gaps: z.array(z.object({ area: z.string(), why: z.string(), action: z.string() })).default([]),
  nextSteps: z.array(z.string()).default([]),
});
export type CareerReport = z.infer<typeof CareerReportSchema>;

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(3).toString("hex")}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

/** Local-only work signals and derived insights, kept beside the profile. */
export class ActivityStore {
  constructor(readonly home: string) {}

  get activityPath(): string {
    return join(this.home, "activity", "activity.jsonl");
  }
  get insightsDir(): string {
    return join(this.home, "insights");
  }
  get careerReportPath(): string {
    return join(this.insightsDir, "career-report.json");
  }

  async readActivities(): Promise<Activity[]> {
    if (!existsSync(this.activityPath)) return [];
    const out: Activity[] = [];
    const lines = (await readFile(this.activityPath, "utf8")).split("\n");
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      const parsed = ActivitySchema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new TracefolioError(`activity.jsonl line ${i + 1}: ${formatIssues(parsed.error)}`);
      out.push(parsed.data);
    });
    return out;
  }

  /** Insert or replace activities by id; a day's session keeps growing until the day ends. */
  async upsertActivities(items: Activity[]): Promise<{ added: number; updated: number }> {
    const existing = new Map((await this.readActivities()).map((a) => [a.id, a]));
    let added = 0;
    let updated = 0;
    for (const item of items) {
      const parsed = ActivitySchema.parse(item);
      const prev = existing.get(parsed.id);
      if (!prev) added++;
      else if (JSON.stringify(prev) !== JSON.stringify(parsed)) updated++;
      existing.set(parsed.id, parsed);
    }
    const sorted = [...existing.values()].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
    await writeAtomic(this.activityPath, sorted.map((a) => `${JSON.stringify(a)}\n`).join(""));
    return { added, updated };
  }

  insightPath(date: string): string {
    return join(this.insightsDir, `${date}.json`);
  }

  async readInsight(date: string): Promise<DailyInsight | undefined> {
    const path = this.insightPath(date);
    if (!existsSync(path)) return undefined;
    return DailyInsightSchema.parse(JSON.parse(await readFile(path, "utf8")));
  }

  async readInsights(): Promise<DailyInsight[]> {
    if (!existsSync(this.insightsDir)) return [];
    const files = (await readdir(this.insightsDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    const out: DailyInsight[] = [];
    for (const f of files) {
      const parsed = DailyInsightSchema.safeParse(JSON.parse(await readFile(join(this.insightsDir, f), "utf8")));
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  }

  async writeInsight(insight: DailyInsight): Promise<void> {
    const parsed = DailyInsightSchema.parse(insight);
    await writeAtomic(this.insightPath(parsed.date), `${JSON.stringify(parsed, null, 2)}\n`);
  }

  async readCareerReport(): Promise<CareerReport | undefined> {
    if (!existsSync(this.careerReportPath)) return undefined;
    const parsed = CareerReportSchema.safeParse(JSON.parse(await readFile(this.careerReportPath, "utf8")));
    return parsed.success ? parsed.data : undefined;
  }

  async writeCareerReport(report: CareerReport): Promise<void> {
    await writeAtomic(this.careerReportPath, `${JSON.stringify(CareerReportSchema.parse(report), null, 2)}\n`);
  }
}

/** The user's local calendar day for an instant (uses the process time zone). */
export function localDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
