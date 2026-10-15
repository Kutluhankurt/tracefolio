import {
  displayableImpact,
  eventDate,
  rankSkills,
  selectEvents,
  type Audience,
  type CareerEvent,
  type Evidence,
  type Profile,
  type Project,
} from "@tracefolio/core";

export interface ContributionView {
  id: string;
  title: string;
  summary: string;
  date: string;
  skills: string[];
  /** Only set when the user verified the metric. */
  impact: string | null;
  status: CareerEvent["status"];
  evidence: EvidenceView[];
}

export type EvidenceView =
  | { kind: "link"; label: string; url: string }
  | { kind: "text"; label: string };

export interface ProjectView {
  id: string;
  name: string;
  description: string;
  url?: string;
  repositoryUrl?: string;
  visibility: Project["visibility"];
  featured: boolean;
  story: NonNullable<Project["story"]>;
  skills: string[];
  contributions: ContributionView[];
  /** Commits counted across contributions, safe to show for private repos. */
  commitCount: number;
}

export interface CareerModel {
  audience: Audience;
  generatedAt: string;
  person: Profile["person"];
  skills: string[];
  experience: Profile["experience"];
  education: Profile["education"];
  projects: ProjectView[];
  /** Approved contributions not attached to any project. */
  otherContributions: ContributionView[];
}

/**
 * Build the view model shared by every output format. This is the single
 * place that decides what is allowed to be shown for an audience.
 */
export function buildCareerModel(profile: Profile, events: CareerEvent[], audience: Audience): CareerModel {
  const selected = selectEvents(events, audience);
  const projectsById = new Map(profile.projects.map((p) => [p.id, p]));
  const byProject = new Map<string, CareerEvent[]>();
  const loose: CareerEvent[] = [];
  for (const event of selected) {
    if (event.project && projectsById.has(event.project)) {
      byProject.set(event.project, [...(byProject.get(event.project) ?? []), event]);
    } else {
      loose.push(event);
    }
  }

  const projects: ProjectView[] = [];
  for (const project of profile.projects) {
    const projectEvents = byProject.get(project.id) ?? [];
    if (projectEvents.length === 0 && !project.featured) continue;
    const isPublic = project.visibility === "public";
    const repositoryUrl = isPublic && project.repository?.startsWith("http") ? project.repository : undefined;
    projects.push({
      id: project.id,
      name: project.name,
      description: project.description,
      url: project.url,
      repositoryUrl,
      visibility: project.visibility,
      featured: project.featured,
      story: project.story ?? {},
      skills: rankSkills({ ...profile, skills: [] }, projectEvents),
      contributions: projectEvents.map((e) => toContribution(e, audience, isPublic, repositoryUrl)),
      commitCount: projectEvents.reduce((n, e) => n + e.evidence.filter((x) => x.type === "git_commit").length, 0),
    });
  }
  projects.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      (b.contributions[0]?.date ?? "").localeCompare(a.contributions[0]?.date ?? "") ||
      a.name.localeCompare(b.name),
  );

  return {
    audience,
    generatedAt: new Date().toISOString(),
    person: profile.person,
    skills: rankSkills(profile, selected),
    experience: profile.experience,
    education: profile.education,
    projects,
    otherContributions: loose.map((e) => toContribution(e, audience, false, undefined)),
  };
}

function toContribution(
  event: CareerEvent,
  audience: Audience,
  isPublic: boolean,
  repositoryUrl: string | undefined,
): ContributionView {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    date: eventDate(event),
    skills: event.skills,
    impact: displayableImpact(event),
    status: event.status,
    evidence: evidenceViews(event.evidence, audience, isPublic, repositoryUrl),
  };
}

function evidenceViews(
  evidence: Evidence[],
  audience: Audience,
  isPublic: boolean,
  repositoryUrl: string | undefined,
): EvidenceView[] {
  const views: EvidenceView[] = [];
  let hiddenCommits = 0;
  for (const ev of evidence) {
    switch (ev.type) {
      case "git_commit":
        if (isPublic && repositoryUrl) {
          views.push({
            kind: "link",
            label: `${ev.commit.slice(0, 7)} ${ev.subject ?? ""}`.trim(),
            url: `${repositoryUrl}/commit/${ev.commit}`,
          });
        } else if (isPublic || audience === "resume") {
          views.push({ kind: "text", label: `${ev.repository}@${ev.commit.slice(0, 7)}` });
        } else {
          hiddenCommits++;
        }
        break;
      case "url":
        views.push({ kind: "link", label: ev.label ?? ev.url, url: ev.url });
        break;
      case "file":
        if (isPublic || audience === "resume") views.push({ kind: "text", label: ev.label ?? ev.path });
        break;
      case "note":
        views.push({ kind: "text", label: ev.text });
        break;
    }
  }
  if (hiddenCommits > 0) {
    views.push({ kind: "text", label: `${hiddenCommits} commit${hiddenCommits === 1 ? "" : "s"} in a private repository` });
  }
  return views;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(value: string | null | undefined): string {
  if (!value) return "Present";
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function formatRange(start?: string | null, end?: string | null): string {
  if (!start) return end ? formatMonth(end) : "";
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}
