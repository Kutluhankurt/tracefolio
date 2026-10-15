import { esc, safeUrl, summaryHtml } from "./html.js";
import type { CareerModel, ContributionView } from "./model.js";
import { formatMonth, formatRange } from "./model.js";

const CSS = `
:root{--ink:#16181d;--muted:#5b6170;--rule:#d9dce3;--accent:#2f4fd8;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:10.5pt/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
main{max-width:780px;margin:0 auto;padding:48px 40px}
h1{font:600 28pt/1.1 "Iowan Old Style","Palatino Linotype",Georgia,serif;margin:0 0 4px;letter-spacing:-.01em}
.headline{font-size:12pt;color:var(--muted);margin:0 0 8px}
.contact{color:var(--muted);font-size:9.5pt;margin:0}
.contact a{color:inherit}
h2{font-size:9pt;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);border-bottom:1px solid var(--rule);padding-bottom:4px;margin:26px 0 10px}
h3{font-size:11pt;margin:14px 0 2px}
.meta{color:var(--muted);font-size:9.5pt;margin:0 0 4px}
ul{margin:4px 0 0;padding-left:18px}
li{margin:2px 0}
.contrib ul{margin-top:2px}
.impact{font-weight:600}
a{color:var(--accent)}
@media print{main{padding:0}a{color:inherit;text-decoration:none}h2{break-after:avoid}h3{break-after:avoid}}
@page{margin:16mm 16mm}
`;

function contribution(c: ContributionView): string {
  return `<li class="contrib"><strong>${esc(c.title)}</strong> <span class="meta">(${esc(formatMonth(c.date))})</span>${summaryHtml(
    c.summary,
  )}${c.impact ? `<div class="impact">Impact: ${esc(c.impact)}</div>` : ""}</li>`;
}

/** A print-ready HTML resume. Open it in a browser and print to PDF. */
export function renderResumeHtml(model: CareerModel): string {
  const p = model.person;
  const contact = [
    p.location ? esc(p.location) : "",
    p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : "",
    ...p.links.map((l) => (safeUrl(l.url) ? `<a href="${esc(l.url)}">${esc(l.label)}</a>` : esc(l.label))),
  ].filter(Boolean);

  const sections: string[] = [];
  if (p.summary) sections.push(`<h2>Summary</h2><p>${esc(p.summary)}</p>`);
  if (model.skills.length) sections.push(`<h2>Skills</h2><p>${model.skills.map(esc).join(", ")}</p>`);
  if (model.experience.length) {
    sections.push(
      `<h2>Experience</h2>${model.experience
        .map(
          (j) =>
            `<h3>${esc(j.role)}, ${esc(j.organization)}</h3><p class="meta">${esc(
              [formatRange(j.start, j.end ?? null), j.location].filter(Boolean).join(" · "),
            )}</p>${j.highlights.length ? `<ul>${j.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}`,
        )
        .join("")}`,
    );
  }
  if (model.projects.length) {
    sections.push(
      `<h2>Projects</h2>${model.projects
        .map((pr) => {
          const links = [pr.url, pr.repositoryUrl]
            .map(safeUrl)
            .filter(Boolean)
            .map((u) => `<a href="${esc(u)}">${esc(u!.replace(/^https?:\/\//, ""))}</a>`);
          const meta = [...links, esc(pr.skills.slice(0, 8).join(", "))].filter(Boolean).join(" · ");
          return `<h3>${esc(pr.name)}</h3>${pr.description ? `<p>${esc(pr.description)}</p>` : ""}${
            meta ? `<p class="meta">${meta}</p>` : ""
          }${pr.contributions.length ? `<ul>${pr.contributions.map(contribution).join("")}</ul>` : ""}`;
        })
        .join("")}`,
    );
  }
  if (model.otherContributions.length) {
    sections.push(`<h2>Selected Contributions</h2><ul>${model.otherContributions.map(contribution).join("")}</ul>`);
  }
  if (model.education.length) {
    sections.push(
      `<h2>Education</h2>${model.education
        .map(
          (e) =>
            `<h3>${esc(e.degree)}, ${esc(e.institution)}</h3><p class="meta">${esc(formatRange(e.start, e.end ?? null))}</p>`,
        )
        .join("")}`,
    );
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.name || "Resume")} — Resume</title>
<style>${CSS}</style>
</head>
<body>
<main>
<header>
<h1>${esc(p.name || "Your Name")}</h1>
${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ""}
${contact.length ? `<p class="contact">${contact.join(" · ")}</p>` : ""}
</header>
${sections.join("\n")}
</main>
</body>
</html>
`;
}
