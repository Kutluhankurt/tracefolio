import { esc, safeUrl, summaryHtml } from "./html.js";
import type { CareerModel, ContributionView, ProjectView } from "./model.js";
import { formatMonth, formatRange } from "./model.js";

export interface PortfolioFile {
  path: string;
  content: string;
}

const STYLES = `
:root{
  --bg:#f6f4ef;--surface:#fffdf8;--ink:#14161b;--muted:#5d6270;--rule:#e2ddd2;
  --accent:#3046d6;--accent-soft:#e6e9fb;--glow:rgba(48,70,214,.18);
  --display:"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif;
  --body:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --radius:18px;--max:1080px;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0e0f13;--surface:#16181e;--ink:#eceae4;--muted:#9a9faa;--rule:#262932;
  --accent:#8fa0ff;--accent-soft:#1d2140;--glow:rgba(143,160,255,.16)}}
:root[data-theme="dark"]{
  --bg:#0e0f13;--surface:#16181e;--ink:#eceae4;--muted:#9a9faa;--rule:#262932;
  --accent:#8fa0ff;--accent-soft:#1d2140;--glow:rgba(143,160,255,.16)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:var(--accent);text-underline-offset:3px}
a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
.skip{position:absolute;left:-999px}.skip:focus{left:16px;top:16px;background:var(--surface);padding:8px 12px;z-index:10}
.nav{position:sticky;top:0;z-index:5;backdrop-filter:saturate(1.4) blur(12px);background:color-mix(in srgb,var(--bg) 78%,transparent);border-bottom:1px solid var(--rule)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{font:600 18px var(--display);color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.nav ul{display:flex;gap:22px;list-style:none;margin:0;padding:0;font-size:14px}
.nav ul a{color:var(--muted);text-decoration:none}.nav ul a:hover{color:var(--ink)}
.theme{border:1px solid var(--rule);background:var(--surface);color:var(--ink);border-radius:999px;width:38px;height:38px;cursor:pointer;display:grid;place-items:center;flex:none}
.theme span{width:15px;height:15px;border-radius:50%;border:1.5px solid currentColor;background:linear-gradient(90deg,currentColor 50%,transparent 50%)}
.hero{position:relative;padding:120px 0 96px;isolation:isolate;overflow:clip}
.hero::before{content:"";position:absolute;inset:-20% -10% auto auto;width:560px;height:560px;border-radius:50%;
  background:radial-gradient(circle at center,var(--glow),transparent 65%);z-index:-1;transform:translate3d(0,calc(var(--scroll,0) * .25px),0)}
.eyebrow{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0 0 18px}
.hero h1{font:500 clamp(48px,9vw,112px)/.95 var(--display);letter-spacing:-.035em;margin:0 0 28px}
.hero .lead{font-size:clamp(19px,2.2vw,24px);line-height:1.5;color:var(--muted);max-width:36ch;margin:0}
.hero .summary{max-width:62ch;margin:28px 0 0}
section{padding:72px 0;border-top:1px solid var(--rule)}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:36px}
h2{font:500 clamp(30px,4vw,44px)/1.1 var(--display);letter-spacing:-.02em;margin:0}
.count{color:var(--muted);font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;margin:0}
.chips li{border:1px solid var(--rule);background:var(--surface);border-radius:999px;padding:7px 15px;font-size:15px}
.chips.small li{font-size:13px;padding:3px 11px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.card{position:relative;display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1px solid var(--rule);border-radius:var(--radius);padding:28px;
  text-decoration:none;color:inherit;transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s,border-color .35s}
.card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--accent) 40%,var(--rule));box-shadow:0 18px 40px -24px var(--glow)}
.card h3{font:500 26px/1.15 var(--display);margin:0;letter-spacing:-.01em}
.card p{margin:0;color:var(--muted)}
.card .arrow{margin-top:auto;font-size:14px;color:var(--accent)}
.tag{display:inline-block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.timeline{list-style:none;margin:0;padding:0;border-left:1px solid var(--rule)}
.timeline>li{position:relative;padding:0 0 36px 28px}
.timeline>li::before{content:"";position:absolute;left:-5px;top:9px;width:9px;height:9px;border-radius:50%;background:var(--accent)}
.timeline time{font-size:13px;color:var(--muted);letter-spacing:.04em}
.timeline h3{font:500 22px/1.25 var(--display);margin:2px 0 6px}
.timeline ul{margin:6px 0 0;padding-left:18px;color:var(--muted)}
.timeline p{margin:6px 0 0;color:var(--muted)}
.impact{display:inline-block;margin-top:10px;background:var(--accent-soft);color:var(--ink);border-radius:8px;padding:4px 10px;font-size:14px}
.jobs{display:grid;gap:28px}
.job h3{font:500 24px/1.2 var(--display);margin:0}
.job .meta{color:var(--muted);font-size:14px;margin:4px 0 8px}
.job ul{margin:0;padding-left:18px}
.story{display:grid;gap:36px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.story h3{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:0 0 8px}
.story p{margin:0}
.evidence{list-style:none;padding:0;margin:12px 0 0;font-size:14px}
.evidence li{padding:3px 0;color:var(--muted)}
.contact-links{display:flex;flex-wrap:wrap;gap:14px;list-style:none;padding:0;margin:0}
.contact-links a{display:inline-block;border:1px solid var(--rule);background:var(--surface);border-radius:999px;padding:10px 20px;text-decoration:none;color:var(--ink)}
.contact-links a:hover{border-color:var(--accent)}
footer{padding:40px 0 60px;color:var(--muted);font-size:13px;border-top:1px solid var(--rule)}
.back{display:inline-block;margin-bottom:28px;font-size:14px;text-decoration:none}
/* Reveal-on-scroll only when JS is present and motion is welcome; content is visible otherwise. */
.js .reveal{opacity:0;transform:translateY(22px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.js .reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .js .reveal{opacity:1;transform:none;transition:none}
  .card,.card:hover{transition:none;transform:none}
  .hero::before{transform:none}
}
@media (max-width:640px){
  .nav ul{display:none}
  .hero{padding:80px 0 64px}
  section{padding:56px 0}
  .card{padding:22px}
}
`;

const SCRIPT = `
(function(){
  var root=document.documentElement;
  try{var saved=localStorage.getItem("tf-theme");if(saved)root.setAttribute("data-theme",saved);}catch(e){}
  var btn=document.querySelector(".theme");
  if(btn)btn.addEventListener("click",function(){
    var dark=root.getAttribute("data-theme")?root.getAttribute("data-theme")==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
    var next=dark?"light":"dark";root.setAttribute("data-theme",next);
    try{localStorage.setItem("tf-theme",next);}catch(e){}
  });
  var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items=document.querySelectorAll(".reveal");
  if(reduce||!("IntersectionObserver" in window)){items.forEach(function(el){el.classList.add("in")});return;}
  var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}})},{rootMargin:"0px 0px -8% 0px"});
  items.forEach(function(el,i){el.style.transitionDelay=Math.min(i%4,3)*70+"ms";io.observe(el)});
  var ticking=false;
  addEventListener("scroll",function(){if(ticking)return;ticking=true;requestAnimationFrame(function(){root.style.setProperty("--scroll",String(scrollY));ticking=false})},{passive:true});
})();
`;

function page(model: CareerModel, title: string, body: string, depth: number): string {
  const prefix = depth === 0 ? "" : "../".repeat(depth);
  const p = model.person;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.headline || p.summary.slice(0, 160))}">
<meta name="generator" content="Tracefolio">
<script>document.documentElement.classList.add("js")</script>
<link rel="stylesheet" href="${prefix}assets/styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<nav class="nav" aria-label="Primary">
  <div class="wrap">
    <a class="brand" href="${prefix}index.html">${esc(p.name || "Portfolio")}</a>
    <ul>
      <li><a href="${prefix}index.html#projects">Projects</a></li>
      <li><a href="${prefix}index.html#journey">Journey</a></li>
      <li><a href="${prefix}index.html#contact">Contact</a></li>
    </ul>
    <button class="theme" type="button" aria-label="Toggle color theme"><span aria-hidden="true"></span></button>
  </div>
</nav>
<main id="main">
${body}
</main>
<footer><div class="wrap">© ${new Date().getFullYear()} ${esc(p.name)} · Built from evidence with Tracefolio</div></footer>
<script src="${prefix}assets/site.js" defer></script>
</body>
</html>
`;
}

function projectCard(project: ProjectView): string {
  const contributions = project.contributions.length;
  return `<a class="card reveal" href="projects/${esc(project.id)}.html">
  <span class="tag">${project.featured ? "Featured" : "Project"}${contributions ? ` · ${contributions} contribution${contributions === 1 ? "" : "s"}` : ""}</span>
  <h3>${esc(project.name)}</h3>
  ${project.description ? `<p>${esc(project.description)}</p>` : ""}
  ${project.skills.length ? `<ul class="chips small">${project.skills.slice(0, 5).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
  <span class="arrow">Read the story →</span>
</a>`;
}

function timelineItem(c: ContributionView, projectName?: string): string {
  return `<li class="reveal">
  <time datetime="${esc(c.date)}">${esc(formatMonth(c.date))}${projectName ? ` · ${esc(projectName)}` : ""}</time>
  <h3>${esc(c.title)}</h3>
  ${summaryHtml(c.summary)}
  ${c.impact ? `<span class="impact">${esc(c.impact)}</span>` : ""}
</li>`;
}

function evidenceList(c: ContributionView): string {
  if (c.evidence.length === 0) return "";
  return `<ul class="evidence">${c.evidence
    .slice(0, 12)
    .map((e) => {
      const url = e.kind === "link" ? safeUrl(e.url) : undefined;
      return `<li>${url ? `<a href="${esc(url)}" rel="noopener">${esc(e.label)}</a>` : esc(e.label)}</li>`;
    })
    .join("")}${c.evidence.length > 12 ? `<li>…and ${c.evidence.length - 12} more</li>` : ""}</ul>`;
}

function renderIndex(model: CareerModel): string {
  const p = model.person;
  const parts: string[] = [];
  parts.push(`<header class="hero"><div class="wrap">
  <p class="eyebrow reveal">Portfolio</p>
  <h1 class="reveal">${esc(p.name || "Your Name")}</h1>
  ${p.headline ? `<p class="lead reveal">${esc(p.headline)}</p>` : ""}
  ${p.summary ? `<p class="summary reveal">${esc(p.summary)}</p>` : ""}
</div></header>`);

  if (model.skills.length) {
    parts.push(`<section id="expertise"><div class="wrap">
  <div class="section-head"><h2 class="reveal">Expertise</h2></div>
  <ul class="chips reveal">${model.skills.slice(0, 18).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
</div></section>`);
  }

  if (model.projects.length) {
    parts.push(`<section id="projects"><div class="wrap">
  <div class="section-head"><h2 class="reveal">Selected projects</h2><span class="count">${model.projects.length}</span></div>
  <div class="grid">${model.projects.map(projectCard).join("\n")}</div>
</div></section>`);
  }

  const names = new Map(model.projects.map((pr) => [pr.id, pr.name]));
  const timeline = [
    ...model.projects.flatMap((pr) => pr.contributions.map((c) => ({ c, project: names.get(pr.id) }))),
    ...model.otherContributions.map((c) => ({ c, project: undefined })),
  ].sort((a, b) => b.c.date.localeCompare(a.c.date));

  if (timeline.length || model.experience.length) {
    parts.push(`<section id="journey"><div class="wrap">
  <div class="section-head"><h2 class="reveal">Journey</h2></div>
  ${
    model.experience.length
      ? `<div class="jobs">${model.experience
          .map(
            (j) => `<article class="job reveal"><h3>${esc(j.role)} · ${esc(j.organization)}</h3>
  <p class="meta">${esc([formatRange(j.start, j.end ?? null), j.location].filter(Boolean).join(" · "))}</p>
  ${j.highlights.length ? `<ul>${j.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}</article>`,
          )
          .join("")}</div>`
      : ""
  }
  ${timeline.length ? `<ol class="timeline" style="margin-top:${model.experience.length ? "48px" : "0"}">${timeline.slice(0, 24).map((t) => timelineItem(t.c, t.project)).join("\n")}</ol>` : ""}
</div></section>`);
  }

  const links = [
    ...(p.email ? [{ label: "Email", url: `mailto:${p.email}` }] : []),
    ...p.links,
  ].filter((l) => safeUrl(l.url));
  if (links.length) {
    parts.push(`<section id="contact"><div class="wrap">
  <div class="section-head"><h2 class="reveal">Let's talk</h2></div>
  <ul class="contact-links reveal">${links.map((l) => `<li><a href="${esc(l.url)}" rel="me noopener">${esc(l.label)}</a></li>`).join("")}</ul>
</div></section>`);
  }

  return page(model, p.name ? `${p.name} — Portfolio` : "Portfolio", parts.join("\n"), 0);
}

const STORY_SECTIONS: Array<[keyof ProjectView["story"], string]> = [
  ["problem", "Problem"],
  ["responsibility", "My role"],
  ["approach", "Approach"],
  ["implementation", "Implementation"],
  ["outcome", "Outcome"],
];

function renderProject(model: CareerModel, project: ProjectView): string {
  const links = [
    project.url ? { label: "Live", url: project.url } : undefined,
    project.repositoryUrl ? { label: "Source", url: project.repositoryUrl } : undefined,
  ].filter((l): l is { label: string; url: string } => !!l && !!safeUrl(l.url));
  const story = STORY_SECTIONS.filter(([key]) => project.story[key]?.trim());

  const body = `<header class="hero"><div class="wrap">
  <a class="back" href="../index.html#projects">← All projects</a>
  <p class="eyebrow reveal">${project.visibility === "private" ? "Private project" : "Project"}</p>
  <h1 class="reveal">${esc(project.name)}</h1>
  ${project.description ? `<p class="lead reveal">${esc(project.description)}</p>` : ""}
  ${links.length ? `<ul class="contact-links reveal" style="margin-top:28px">${links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.label)}</a></li>`).join("")}</ul>` : ""}
</div></header>
${
  story.length
    ? `<section><div class="wrap"><div class="story">${story
        .map(([key, label]) => `<div class="reveal"><h3>${label}</h3><p>${esc(project.story[key])}</p></div>`)
        .join("")}</div></div></section>`
    : ""
}
${
  project.skills.length
    ? `<section><div class="wrap"><div class="section-head"><h2 class="reveal">Stack</h2></div><ul class="chips reveal">${project.skills
        .map((s) => `<li>${esc(s)}</li>`)
        .join("")}</ul></div></section>`
    : ""
}
${
  project.contributions.length
    ? `<section><div class="wrap"><div class="section-head"><h2 class="reveal">Contributions &amp; evidence</h2><span class="count">${project.contributions.length}</span></div>
<ol class="timeline">${project.contributions
        .map(
          (c) => `<li class="reveal"><time datetime="${esc(c.date)}">${esc(formatMonth(c.date))}</time><h3>${esc(c.title)}</h3>${summaryHtml(
            c.summary,
          )}${c.impact ? `<span class="impact">${esc(c.impact)}</span>` : ""}${evidenceList(c)}</li>`,
        )
        .join("\n")}</ol></div></section>`
    : ""
}`;
  return page(model, `${project.name} — ${model.person.name || "Portfolio"}`, body, 1);
}

/** Render the static portfolio site. Paths are relative to the output directory. */
export function renderPortfolio(model: CareerModel): PortfolioFile[] {
  return [
    { path: "index.html", content: renderIndex(model) },
    ...model.projects.map((project) => ({ path: `projects/${project.id}.html`, content: renderProject(model, project) })),
    { path: "assets/styles.css", content: STYLES.trimStart() },
    { path: "assets/site.js", content: SCRIPT.trimStart() },
    { path: "portfolio.json", content: `${JSON.stringify(model, null, 2)}\n` },
  ];
}
