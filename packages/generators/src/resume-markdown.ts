import type { CareerModel, ContributionView } from "./model.js";
import { formatMonth, formatRange } from "./model.js";

/** Escape characters that would change Markdown structure in user text. */
function md(text: string): string {
  return text.replace(/([\\`*_[\]<>])/g, "\\$1");
}

function contributionLines(c: ContributionView): string[] {
  const head = `- **${md(c.title)}** (${formatMonth(c.date)})`;
  const lines: string[] = [];
  const summary = c.summary.trim();
  const bulletLines = summary.split("\n").filter((l) => l.trim());
  if (bulletLines.length > 0 && bulletLines.every((l) => /^\s*[-*] /.test(l))) {
    lines.push(head);
    for (const l of bulletLines) lines.push(`  - ${md(l.replace(/^\s*[-*] /, ""))}`);
  } else {
    lines.push(summary ? `${head}: ${md(summary.replace(/\s+/g, " "))}` : head);
  }
  if (c.impact) lines.push(`  - Impact: ${md(c.impact)}`);
  return lines;
}

/** An ATS-friendly resume: plain headings, no tables, no images, no columns. */
export function renderResumeMarkdown(model: CareerModel): string {
  const { person } = model;
  const out: string[] = [];
  out.push(`# ${md(person.name || "Your Name")}`);
  if (person.headline) out.push("", md(person.headline));
  const contact = [
    person.location,
    person.email,
    ...person.links.map((l) => `${l.label}: ${l.url}`),
  ].filter(Boolean) as string[];
  if (contact.length) out.push("", contact.map(md).join(" | "));

  if (person.summary) out.push("", "## Summary", "", md(person.summary));

  if (model.skills.length) out.push("", "## Skills", "", model.skills.map(md).join(", "));

  if (model.experience.length) {
    out.push("", "## Experience");
    for (const job of model.experience) {
      out.push("", `### ${md(job.role)}, ${md(job.organization)}`);
      out.push([formatRange(job.start, job.end ?? null), job.location].filter(Boolean).join(" | "));
      if (job.highlights.length) out.push("", ...job.highlights.map((h) => `- ${md(h)}`));
    }
  }

  if (model.projects.length) {
    out.push("", "## Projects");
    for (const project of model.projects) {
      out.push("", `### ${md(project.name)}`);
      const meta = [project.url, project.repositoryUrl, project.skills.slice(0, 8).join(", ")].filter(Boolean);
      if (project.description) out.push(md(project.description));
      if (meta.length) out.push("", meta.map((m) => md(m!)).join(" | "));
      if (project.contributions.length) {
        out.push("");
        for (const c of project.contributions) out.push(...contributionLines(c));
      }
    }
  }

  if (model.otherContributions.length) {
    out.push("", "## Selected Contributions", "");
    for (const c of model.otherContributions) out.push(...contributionLines(c));
  }

  if (model.education.length) {
    out.push("", "## Education");
    for (const e of model.education) {
      out.push("", `### ${md(e.degree)}, ${md(e.institution)}`);
      const range = formatRange(e.start, e.end ?? null);
      if (range) out.push(range);
    }
  }

  return `${out.join("\n")}\n`;
}

export interface AtsIssue {
  level: "warning" | "info";
  message: string;
}

/** Lightweight checks that catch the most common ATS and completeness problems. */
export function checkAts(model: CareerModel, markdown: string): AtsIssue[] {
  const issues: AtsIssue[] = [];
  if (!model.person.name) issues.push({ level: "warning", message: "person.name is empty" });
  if (!model.person.email) issues.push({ level: "warning", message: "person.email is empty; recruiters cannot contact you" });
  if (!model.person.headline) issues.push({ level: "info", message: "person.headline is empty" });
  if (model.skills.length === 0) issues.push({ level: "warning", message: "no skills to list" });
  if (model.projects.length + model.otherContributions.length + model.experience.length === 0) {
    issues.push({ level: "warning", message: "no approved contributions or experience yet; run `tracefolio review`" });
  }
  const words = markdown.split(/\s+/).filter(Boolean).length;
  if (words > 1100) issues.push({ level: "info", message: `resume is ${words} words; consider trimming to ~2 pages` });
  if (/[^\x00-\x7F -ɏ–—…·]/.test(markdown)) {
    issues.push({ level: "info", message: "resume contains symbols/emoji some ATS parsers drop" });
  }
  return issues;
}
