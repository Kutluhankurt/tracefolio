import { execFile } from "node:child_process";
import { z } from "zod";
import {
  APPROVED_STATUSES,
  commitKey,
  newEventId,
  nowIso,
  rankSkills,
  redactSecrets,
  referencedCommits,
  type Activity,
  type CareerEvent,
  type CareerEventInput,
  type CareerReport,
  type Config,
  type DailyInsight,
  type Profile,
} from "@tracefolio/core";
import { projectSlug } from "@tracefolio/git-adapter";
import { langOf, profileGaps, skillCoverage, type Lang } from "./gaps.js";

export interface InsightInput {
  date: string;
  profile: Profile;
  events: CareerEvent[];
  activities: Activity[];
  config: Config;
}

export interface InsightOutput {
  insight: DailyInsight;
  report: CareerReport;
  drafts: CareerEventInput[];
  warnings: string[];
}

const ClaudeResponseSchema = z.object({
  daily: z.object({
    summary: z.string(),
    highlights: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    suggestions: z
      .array(
        z.object({
          title: z.string().min(1).max(200),
          summary: z.string().max(2000).default(""),
          skills: z.array(z.string()).default([]),
          project: z.string().optional(),
          commits: z.array(z.string()).default([]),
        }),
      )
      .max(5)
      .default([]),
  }),
  career: z.object({
    headline: z.string().optional(),
    strengths: z.array(z.object({ area: z.string(), evidence: z.string() })).default([]),
    gaps: z.array(z.object({ area: z.string(), why: z.string(), action: z.string() })).default([]),
    nextSteps: z.array(z.string()).default([]),
  }),
});
type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;

const PROMPT_CHAR_BUDGET = 24000;

function dayBundle(activities: Activity[]) {
  let budget = PROMPT_CHAR_BUDGET;
  const byProject = new Map<string, { project: string; minutes: number; prompts: string[]; commits: Activity["commits"]; files: string[]; skills: Set<string> }>();
  for (const a of activities) {
    const p = byProject.get(a.project) ?? { project: a.project, minutes: 0, prompts: [], commits: [], files: [], skills: new Set<string>() };
    p.minutes += a.activeMinutes;
    for (const prompt of a.prompts) {
      if (budget - prompt.length < 0) break;
      budget -= prompt.length;
      p.prompts.push(prompt);
    }
    p.commits.push(...a.commits);
    p.files.push(...a.files.slice(0, 15));
    a.skills.forEach((s) => p.skills.add(s));
    byProject.set(a.project, p);
  }
  return [...byProject.values()].map((p) => ({ ...p, files: [...new Set(p.files)].slice(0, 20), skills: [...p.skills] }));
}

function buildPrompt(input: InsightInput, lang: Lang): string {
  const approved = input.events.filter((e) => APPROVED_STATUSES.includes(e.status));
  const recent = input.activities.filter((a) => a.date <= input.date);
  const today = recent.filter((a) => a.date === input.date);
  const coverage = skillCoverage(approved, recent.slice(-400), lang);
  const data = {
    date: input.date,
    targetRole: input.config.insights.targetRole,
    today: dayBundle(today),
    last30DaysSkills: rankSkills({ ...input.profile, skills: [] }, recent.slice(-300).map((a) => ({ skills: a.skills }) as CareerEvent)).slice(0, 25),
    resume: {
      headline: input.profile.person.headline,
      experienceCount: input.profile.experience.length,
      approvedRecords: approved.slice(0, 40).map((e) => ({ title: e.title, project: e.project, skills: e.skills })),
    },
    skillCoverage: coverage.map((c) => ({ area: c.area, status: c.status })),
  };
  const language = lang === "tr" ? "Turkish" : "English";
  return `You are Tracefolio's career analyst. You receive one day of a software developer's real work signals (their own AI-assistant prompts, commits, files touched) plus their current resume. Reply with ONE JSON object and nothing else.

Rules:
- Never invent facts, metrics, users, employers or outcomes. Only describe what the data shows. If a day has little signal, say so briefly.
- "daily.summary": 2-4 sentences in ${language}: what they worked on and achieved today.
- "daily.highlights": up to 5 short bullets in ${language}.
- "daily.skills": technologies and practices actually exercised today.
- "daily.suggestions": 0-3 resume-worthy accomplishments from TODAY only, written in English for a resume (title starts with a past-tense verb, under 12 words; summary 1-2 sentences). Only for meaningful finished work, not chores or questions. "project" must be one of today's project names. "commits" may only contain hashes present in today's data. Return [] when nothing qualifies.
- "career": in ${language}, for the target role "${data.targetRole}", based on the whole resume and recent skills: "headline" (one-line resume headline suggestion, English), "strengths" (max 4, each with concrete evidence from the data), "gaps" (max 5, each with why it matters for the role and one concrete next action), "nextSteps" (max 3, doable this week).

JSON shape:
{"daily":{"summary":"","highlights":[],"skills":[],"suggestions":[{"title":"","summary":"","skills":[],"project":"","commits":[]}]},"career":{"headline":"","strengths":[{"area":"","evidence":""}],"gaps":[{"area":"","why":"","action":""}],"nextSteps":[]}}

DATA:
${JSON.stringify(data)}`;
}

function runClaude(prompt: string, options: { cwd: string; model?: string; timeoutMs?: number }): Promise<string> {
  const args = ["-p", "--output-format", "json", "--max-turns", "1"];
  if (options.model) args.push("--model", options.model);
  return new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      args,
      { cwd: options.cwd, timeout: options.timeoutMs ?? 240000, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`claude -p failed: ${(stderr || err.message).trim().slice(0, 300)}`));
        try {
          const envelope = JSON.parse(stdout) as { result?: string; is_error?: boolean };
          if (envelope.is_error || typeof envelope.result !== "string") return reject(new Error("claude -p returned an error"));
          resolve(envelope.result);
        } catch {
          reject(new Error("claude -p returned unreadable output"));
        }
      },
    );
    child.stdin?.end(prompt);
  });
}

export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}

function rulesSummary(today: Activity[], lang: Lang): Pick<DailyInsight, "summary" | "highlights" | "skills"> {
  const t = (en: string, tr: string) => (lang === "tr" ? tr : en);
  if (today.length === 0) {
    return { summary: t("No recorded activity on this day.", "Bu gün kayıtlı bir aktivite yok."), highlights: [], skills: [] };
  }
  const projects = [...new Set(today.map((a) => a.project))];
  const minutes = today.reduce((n, a) => n + a.activeMinutes, 0);
  const prompts = today.reduce((n, a) => n + a.promptCount, 0);
  const commits = today.reduce((n, a) => n + a.commits.length, 0);
  const hours = (minutes / 60).toFixed(1);
  const summary = t(
    `Worked on ${projects.join(", ")}: about ${hours} active hours, ${prompts} AI prompts and ${commits} commits.`,
    `${projects.join(", ")} üzerinde çalıştın: yaklaşık ${hours} saat aktif, ${prompts} AI isteği ve ${commits} commit.`,
  );
  const highlights = [
    ...today.flatMap((a) => a.commits.map((c) => `${a.project}: ${c.subject}`)),
    ...today.flatMap((a) => a.prompts.slice(0, 1).map((p) => `${a.project}: ${p.slice(0, 140)}`)),
  ].slice(0, 6);
  return { summary, highlights, skills: [...new Set(today.flatMap((a) => a.skills))].sort() };
}

function rulesReport(input: InsightInput, lang: Lang): CareerReport {
  const approved = input.events.filter((e) => APPROVED_STATUSES.includes(e.status));
  const coverage = skillCoverage(approved, input.activities.slice(-400), lang);
  const t = (en: string, tr: string) => (lang === "tr" ? tr : en);
  return {
    generatedAt: nowIso(),
    engine: "rules",
    targetRole: input.config.insights.targetRole,
    strengths: coverage
      .filter((c) => c.status === "strong")
      .slice(0, 4)
      .map((c) => ({ area: c.area, evidence: t(`On your resume: ${c.onResume.join(", ")}`, `CV'nde: ${c.onResume.join(", ")}`) })),
    gaps: [
      ...coverage
        .filter((c) => c.status !== "strong")
        .map((c) => ({
          area: c.area,
          why:
            c.status === "practicing"
              ? t(`You use ${c.inPractice.join(", ")}, but no approved record shows it.`, `${c.inPractice.join(", ")} kullanıyorsun ama onaylı bir kayıtta görünmüyor.`)
              : t("Nothing in your record demonstrates this yet.", "Kaydında bunu gösteren bir şey henüz yok."),
          action: c.status === "practicing" ? t("Capture that work and approve it.", "O işi kaydet ve onayla.") : c.action,
        })),
      ...profileGaps(input.profile, input.events, lang),
    ].slice(0, 8),
    nextSteps: [],
  };
}

/** Produce the day's insight, the career report and draft suggestions. */
export async function generateInsights(
  input: InsightInput,
  options: { home: string; engine?: "claude" | "rules" },
): Promise<InsightOutput> {
  const lang = langOf(input.config.insights.language);
  const engine = options.engine ?? input.config.insights.engine;
  const today = input.activities.filter((a) => a.date === input.date);
  const warnings: string[] = [];
  let response: ClaudeResponse | undefined;

  if (engine === "claude" && today.length > 0) {
    try {
      const raw = await runClaude(buildPrompt(input, lang), { cwd: options.home, model: input.config.insights.model });
      const parsed = ClaudeResponseSchema.safeParse(extractJson(raw));
      if (parsed.success) response = parsed.data;
      else warnings.push("Claude's answer did not match the expected format; used local rules instead.");
    } catch (err) {
      warnings.push(`${(err as Error).message}; used local rules instead.`);
    }
  }

  const base = rulesSummary(today, lang);
  const projects = new Map(today.map((a) => [a.project.toLowerCase(), a.project]));
  const dayCommits = new Map(today.flatMap((a) => a.commits.map((c) => [c.hash.slice(0, 7).toLowerCase(), { ...c, project: a.project }])));
  const known = referencedCommits(input.events);
  const drafts: CareerEventInput[] = [];
  const suggestions: DailyInsight["suggestions"] = [];

  for (const s of response?.daily.suggestions ?? []) {
    const project = s.project ? projects.get(s.project.toLowerCase()) : undefined;
    const cited = s.commits.map((h) => dayCommits.get(h.slice(0, 7).toLowerCase())).filter((c) => !!c);
    // Work whose commits are all on record already is captured; don't draft it again.
    if (cited.length > 0 && cited.every((c) => known.has(commitKey(c!.hash)))) continue;
    const commits = s.commits
      .map((h) => dayCommits.get(h.slice(0, 7).toLowerCase()))
      .filter((c): c is NonNullable<typeof c> => !!c && !known.has(commitKey(c.hash)));
    const suggestion = { title: redactSecrets(s.title), summary: redactSecrets(s.summary), skills: s.skills, project, commits: commits.map((c) => c.hash) };
    if (input.config.insights.createDrafts) {
      const promptCount = today.filter((a) => a.project === project).reduce((n, a) => n + a.promptCount, 0);
      const id = newEventId();
      drafts.push({
        id,
        type: "project_contribution",
        title: suggestion.title,
        summary: suggestion.summary,
        skills: suggestion.skills,
        project: project ? projectSlug(project) : undefined,
        evidence: [
          ...commits.map((c) => ({ type: "git_commit" as const, repository: c.project, commit: c.hash, subject: c.subject })),
          { type: "note" as const, text: `Suggested by Tracefolio insights from ${promptCount} AI prompt(s) on ${input.date}${project ? ` in ${project}` : ""}.` },
        ],
        impact: { metric: null, verified: false },
        status: "draft",
        source: "insights",
        period: { start: `${input.date}T00:00:00.000Z`, end: `${input.date}T23:59:59.000Z` },
        createdAt: nowIso(),
      });
      commits.forEach((c) => known.add(commitKey(c.hash)));
      suggestions.push({ ...suggestion, eventId: id });
    } else {
      suggestions.push(suggestion);
    }
  }

  const insight: DailyInsight = {
    date: input.date,
    generatedAt: nowIso(),
    engine: response ? "claude" : "rules",
    summary: response?.daily.summary ?? base.summary,
    highlights: response?.daily.highlights ?? base.highlights,
    skills: response?.daily.skills.length ? response.daily.skills : base.skills,
    suggestions,
  };

  const rules = rulesReport(input, lang);
  const report: CareerReport = response
    ? {
        generatedAt: nowIso(),
        engine: "claude",
        targetRole: input.config.insights.targetRole,
        headline: response.career.headline,
        strengths: response.career.strengths,
        gaps: response.career.gaps,
        nextSteps: response.career.nextSteps,
      }
    : rules;

  return { insight, report, drafts, warnings };
}
