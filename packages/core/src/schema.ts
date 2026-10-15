import { z } from "zod";

/** Lifecycle of every career record. Nothing leaves `draft` without the user. */
export const RECORD_STATUSES = ["draft", "reviewed", "verified", "published", "rejected"] as const;
export const RecordStatusSchema = z.enum(RECORD_STATUSES);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

/** Statuses the user has explicitly approved. Only these may appear in a resume. */
export const APPROVED_STATUSES: readonly RecordStatus[] = ["reviewed", "verified", "published"];
/** Only explicitly published records may appear in the public portfolio. */
export const PUBLIC_STATUSES: readonly RecordStatus[] = ["published"];

export const EVENT_TYPES = [
  "project_contribution",
  "achievement",
  "skill",
  "experience",
  "learning",
  "other",
] as const;
export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EVENT_SOURCES = ["git", "claude-code", "codex", "manual", "other"] as const;
export const EventSourceSchema = z.enum(EVENT_SOURCES);
export type EventSource = z.infer<typeof EventSourceSchema>;

const isoDateTime = z.string().datetime({ offset: true });
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "expected YYYY-MM");
const slug = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "expected a lowercase slug (a-z, 0-9, ., _, -)");

export const GitCommitEvidenceSchema = z.object({
  type: z.literal("git_commit"),
  repository: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/, "expected a git commit hash"),
  date: isoDateTime.optional(),
  subject: z.string().optional(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  filesChanged: z.number().int().nonnegative().optional(),
});

export const EvidenceSchema = z.discriminatedUnion("type", [
  GitCommitEvidenceSchema,
  z.object({ type: z.literal("url"), url: z.string().url(), label: z.string().optional() }),
  z.object({
    type: z.literal("file"),
    path: z.string().min(1),
    repository: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({ type: z.literal("note"), text: z.string().min(1) }),
]);
export type Evidence = z.infer<typeof EvidenceSchema>;
export type GitCommitEvidence = z.infer<typeof GitCommitEvidenceSchema>;

export const ImpactSchema = z.object({
  /** A measured outcome, e.g. "p95 latency 480ms -> 120ms". Never invented. */
  metric: z.string().min(1).nullable().default(null),
  /** True only when the metric itself is backed by evidence the user confirmed. */
  verified: z.boolean().default(false),
});

export const CareerEventSchema = z
  .object({
    id: z.string().regex(/^evt_[a-z0-9]+$/, "expected an id like evt_xxx"),
    type: EventTypeSchema.default("project_contribution"),
    title: z.string().min(1).max(200),
    summary: z.string().max(4000).default(""),
    skills: z.array(z.string().min(1)).default([]),
    project: z.string().min(1).optional(),
    evidence: z.array(EvidenceSchema).default([]),
    impact: ImpactSchema.default({}),
    status: RecordStatusSchema.default("draft"),
    source: EventSourceSchema.default("manual"),
    period: z.object({ start: isoDateTime, end: isoDateTime }).optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime.optional(),
  })
  .superRefine((event, ctx) => {
    if (event.status === "verified" && event.evidence.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "a record can only be 'verified' when it has at least one piece of evidence",
      });
    }
    if (event.impact.verified && event.impact.metric === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["impact", "verified"],
        message: "impact cannot be verified without a metric",
      });
    }
    if (event.impact.verified && event.evidence.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["impact", "verified"],
        message: "impact cannot be verified without evidence",
      });
    }
  });
export type CareerEvent = z.infer<typeof CareerEventSchema>;
export type CareerEventInput = z.input<typeof CareerEventSchema>;

export const LinkSchema = z.object({ label: z.string().min(1), url: z.string().url() });

export const ProjectStorySchema = z
  .object({
    problem: z.string(),
    responsibility: z.string(),
    approach: z.string(),
    implementation: z.string(),
    outcome: z.string(),
  })
  .partial();

export const ProjectSchema = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().default(""),
  url: z.string().url().optional(),
  repository: z.string().optional(),
  /** Private projects never expose repository links or commit hashes publicly. */
  visibility: z.enum(["public", "private"]).default("private"),
  featured: z.boolean().default(false),
  story: ProjectStorySchema.optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ExperienceSchema = z.object({
  organization: z.string().min(1),
  role: z.string().min(1),
  start: yearMonth,
  end: yearMonth.nullable().optional(),
  location: z.string().optional(),
  highlights: z.array(z.string().min(1)).default([]),
});

export const EducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  start: yearMonth.optional(),
  end: yearMonth.nullable().optional(),
});

export const ProfileSchema = z.object({
  version: z.literal(1).default(1),
  person: z.object({
    name: z.string().default(""),
    headline: z.string().default(""),
    summary: z.string().default(""),
    location: z.string().optional(),
    email: z.string().email().optional(),
    links: z.array(LinkSchema).default([]),
  }),
  identities: z
    .object({
      /** Commits are attributed to the user only when authored by one of these emails. */
      gitEmails: z.array(z.string().min(3)).default([]),
    })
    .default({}),
  skills: z.array(z.string().min(1)).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileInput = z.input<typeof ProfileSchema>;

export const ConfigSchema = z.object({
  version: z.literal(1).default(1),
  analyze: z
    .object({
      groupBy: z.enum(["commit", "day", "week"]).default("week"),
      maxCommits: z.number().int().positive().default(2000),
    })
    .default({}),
  privacy: z
    .object({
      /** Extra glob patterns treated as sensitive, on top of the built-in list. */
      sensitivePatterns: z.array(z.string().min(1)).default([]),
      redactSecrets: z.boolean().default(true),
    })
    .default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Format zod issues as short, human-readable lines. */
export function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
