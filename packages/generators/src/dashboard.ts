import type { Activity, CareerEvent, CareerReport, DailyInsight } from "@tracefolio/core";
import { esc } from "./html.js";

export interface CoverageRow {
  area: string;
  status: "strong" | "practicing" | "gap";
  onResume: string[];
  inPractice: string[];
  action: string;
}

export interface DashboardData {
  generatedAt: string;
  today: string;
  lang: "tr" | "en";
  person: { name: string; headline: string };
  targetRole: string;
  activities: Activity[];
  insights: DailyInsight[];
  report?: CareerReport;
  coverage: CoverageRow[];
  profileGaps: Array<{ area: string; why: string; action: string }>;
  events: Array<Pick<CareerEvent, "id" | "title" | "summary" | "status" | "source" | "project" | "skills" | "createdAt">>;
  resumeHtml: string;
}

const STRINGS = {
  tr: {
    title: "Kariyer Paneli",
    tabs: { today: "Bugün", days: "Günlük", calendar: "Takvim", cv: "CV", career: "Kariyer" },
    updated: "Son güncelleme",
    activeTime: "Aktif süre",
    prompts: "AI isteği",
    commits: "Commit",
    projects: "Proje",
    hoursShort: "sa",
    minutesShort: "dk",
    summary: "Günün özeti",
    highlights: "Öne çıkanlar",
    skillsUsed: "Kullanılan beceriler",
    suggestions: "CV önerileri",
    noSuggestions: "Bugün CV'ye eklenecek bitmiş bir iş önerilmedi.",
    noActivity: "Bu gün için kayıtlı aktivite yok.",
    showingLast: "Bugün henüz aktivite yok; son aktif gün gösteriliyor:",
    engineClaude: "Claude çıkarımı",
    engineRules: "Kural tabanlı özet",
    approve: "CV'ye ekle",
    publish: "Portföyde yayınla",
    reject: "Reddet",
    status: { draft: "Taslak", reviewed: "CV'de", verified: "Doğrulandı", published: "Yayında", rejected: "Reddedildi" },
    commandHint: "Onaylamak için",
    pending: "Onay bekleyen taslaklar",
    noPending: "Onay bekleyen taslak yok.",
    resume: "Güncel CV",
    resumeNote: "Yalnızca onayladığın kayıtlar CV'de görünür.",
    dayDetail: "Projeler",
    showPrompts: "İstekleri göster",
    noInsight: "Özet yok",
    activeDays30: "Son 30 günde aktif gün",
    activeDays90: "Son 90 günde aktif gün",
    streak: "En uzun seri",
    thisWeek: "Bu hafta",
    days: "gün",
    byProject: "Projelere göre",
    lastWorked: "Son çalışma",
    less: "Az",
    more: "Çok",
    role: "Hedef rol",
    headline: "Önerilen CV başlığı",
    strengths: "Güçlü yönler",
    gaps: "Eksikler",
    nextSteps: "Bu hafta yapabileceklerin",
    coverage: "Beceri haritası",
    coverageNote: "CV'de: onaylı bir kayıt kanıtlıyor · Pratikte: son çalışmalarda var ama CV'de yok · Eksik: hiç görünmüyor",
    covStatus: { strong: "CV'de", practicing: "Pratikte", gap: "Eksik" },
    profileGaps: "Profilde eksik olanlar",
    timeline: "Beceri gelişimi (aktif gün sayısı)",
    noReport: "Henüz kariyer raporu yok. `tracefolio daily` çalıştığında oluşur.",
    saved: "Kaydedildi",
    failed: "Kaydedilemedi",
    staticNote: "Butonlar `tracefolio dashboard` ile açıldığında çalışır. Şu an komutu kopyalayabilirsin.",
    copy: "Kopyala",
    copied: "Kopyalandı",
    weekdays: ["Pzt", "", "Çar", "", "Cum", "", ""],
  },
  en: {
    title: "Career Dashboard",
    tabs: { today: "Today", days: "Daily log", calendar: "Calendar", cv: "Resume", career: "Career" },
    updated: "Updated",
    activeTime: "Active time",
    prompts: "AI prompts",
    commits: "Commits",
    projects: "Projects",
    hoursShort: "h",
    minutesShort: "m",
    summary: "Summary",
    highlights: "Highlights",
    skillsUsed: "Skills used",
    suggestions: "Resume suggestions",
    noSuggestions: "No finished, resume-worthy work suggested today.",
    noActivity: "No recorded activity on this day.",
    showingLast: "No activity yet today; showing your last active day:",
    engineClaude: "Claude insight",
    engineRules: "Rule-based summary",
    approve: "Add to resume",
    publish: "Publish to portfolio",
    reject: "Reject",
    status: { draft: "Draft", reviewed: "On resume", verified: "Verified", published: "Published", rejected: "Rejected" },
    commandHint: "To approve",
    pending: "Drafts waiting for review",
    noPending: "No drafts waiting.",
    resume: "Current resume",
    resumeNote: "Only records you approved appear on your resume.",
    dayDetail: "Projects",
    showPrompts: "Show prompts",
    noInsight: "No summary",
    activeDays30: "Active days, last 30",
    activeDays90: "Active days, last 90",
    streak: "Longest streak",
    thisWeek: "This week",
    days: "days",
    byProject: "By project",
    lastWorked: "Last worked",
    less: "Less",
    more: "More",
    role: "Target role",
    headline: "Suggested headline",
    strengths: "Strengths",
    gaps: "Gaps",
    nextSteps: "Next steps this week",
    coverage: "Skill map",
    coverageNote: "On resume: an approved record proves it · In practice: seen in recent work, not on resume · Gap: not seen",
    covStatus: { strong: "On resume", practicing: "In practice", gap: "Gap" },
    profileGaps: "Missing from your profile",
    timeline: "Skill growth (active days)",
    noReport: "No career report yet. It appears after `tracefolio daily` runs.",
    saved: "Saved",
    failed: "Could not save",
    staticNote: "Buttons work when opened with `tracefolio dashboard`. For now, copy the command.",
    copy: "Copy",
    copied: "Copied",
    weekdays: ["Mon", "", "Wed", "", "Fri", "", ""],
  },
};

const CSS = `
:root{
  --bg:#f4f5f9;--surface:#fff;--ink:#141726;--muted:#5b6178;--rule:#dfe2ec;--accent:#3046d6;--accent-soft:#e8ebfc;
  --ok:#1f7a4d;--ok-soft:#e3f4ea;--warn:#9a5b00;--warn-soft:#fbf0dc;--bad:#b42318;--bad-soft:#fde8e6;
  --h0:#e7e9f1;--h1:#c4cbf5;--h2:#8f9ceb;--h3:#5568df;--h4:#2a3cb8;
  --font:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0e1017;--surface:#171a24;--ink:#e9ebf3;--muted:#9aa0b6;--rule:#282c3b;--accent:#8e9cff;--accent-soft:#20264a;
  --ok:#5fd39a;--ok-soft:#16301f;--warn:#f0b056;--warn-soft:#33260f;--bad:#ff7b6e;--bad-soft:#3a1714;
  --h0:#1d2030;--h1:#28316b;--h2:#3a4aa8;--h3:#5a6be0;--h4:#9aa8ff;color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#0e1017;--surface:#171a24;--ink:#e9ebf3;--muted:#9aa0b6;--rule:#282c3b;--accent:#8e9cff;--accent-soft:#20264a;
  --ok:#5fd39a;--ok-soft:#16301f;--warn:#f0b056;--warn-soft:#33260f;--bad:#ff7b6e;--bad-soft:#3a1714;
  --h0:#1d2030;--h1:#28316b;--h2:#3a4aa8;--h3:#5a6be0;--h4:#9aa8ff;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--font)}
a{color:var(--accent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.wrap{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header.top{background:var(--surface);border-bottom:1px solid var(--rule);position:sticky;top:0;z-index:5}
.top-row{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 16px;padding-block:16px 6px}
.top-row h1{font:500 24px/1.2 var(--display);margin:0;letter-spacing:-.01em}
.top-row .meta{color:var(--muted);font-size:13px}
nav.tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
nav.tabs a{padding:10px 14px;color:var(--muted);text-decoration:none;border-bottom:2px solid transparent;white-space:nowrap;font-weight:600;font-size:14px}
nav.tabs a[aria-current="page"]{color:var(--ink);border-bottom-color:var(--accent)}
main{padding-block:24px 64px}
section.tab{display:flex;flex-direction:column;gap:20px}
h2{font:500 22px/1.25 var(--display);margin:0}
h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:18px 20px;min-width:0}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.kpis{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.kpi{background:var(--surface);border:1px solid var(--rule);border-radius:12px;padding:14px 16px}
.kpi b{display:block;font:600 26px/1.1 var(--font);font-variant-numeric:tabular-nums}
.kpi span{color:var(--muted);font-size:13px}
.lede{font-size:17px;line-height:1.6;margin:0}
.badge{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 10px;background:var(--accent-soft);color:var(--accent)}
.pill{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap}
.pill.strong,.pill.reviewed,.pill.verified,.pill.published{background:var(--ok-soft);color:var(--ok)}
.pill.practicing,.pill.draft{background:var(--warn-soft);color:var(--warn)}
.pill.gap,.pill.rejected{background:var(--bad-soft);color:var(--bad)}
.chips{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.chips li{border:1px solid var(--rule);border-radius:999px;padding:2px 10px;font-size:13px;background:var(--bg)}
ul.plain{margin:0;padding-left:18px}
ul.plain li{margin:3px 0}
.sugg{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--rule);padding-top:14px;margin-top:14px}
.sugg:first-of-type{border-top:0;margin-top:0;padding-top:0}
.sugg-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.sugg-head strong{font-size:16px}
.sugg p{margin:0;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:600 13px var(--font);border-radius:8px;padding:7px 12px;cursor:pointer;border:1px solid var(--rule);background:var(--surface);color:var(--ink)}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--surface)}
button:disabled{opacity:.5;cursor:default}
code.cmd{display:block;font:12.5px var(--mono);background:var(--bg);border:1px solid var(--rule);border-radius:8px;padding:8px 10px;overflow-x:auto;white-space:pre}
.muted{color:var(--muted)}
.note{font-size:13px;color:var(--muted);margin:0}
.day{display:flex;flex-direction:column;gap:10px}
.day-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 12px;align-items:baseline}
.day-head h2{font-size:19px}
.proj-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:8px 0;border-top:1px solid var(--rule)}
.proj-row .nums{font:13px var(--mono);color:var(--muted);font-variant-numeric:tabular-nums;text-align:right}
details summary{cursor:pointer;color:var(--accent);font-size:13px;margin-top:4px}
details ol{margin:8px 0 0;padding-left:20px;color:var(--muted);font-size:14px}
.heat-wrap{overflow-x:auto}
.heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,14px);gap:3px;width:max-content}
.heat .cell{width:14px;height:14px;border-radius:3px;background:var(--h0);border:0;padding:0}
.heat .l1{background:var(--h1)}.heat .l2{background:var(--h2)}.heat .l3{background:var(--h3)}.heat .l4{background:var(--h4)}
.heat .cell.future{visibility:hidden}
.heat-axis{display:grid;grid-template-rows:repeat(7,14px);gap:3px;font-size:10px;color:var(--muted);margin-right:6px}
.heat-row{display:flex}
.legend{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);margin-top:10px}
.legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em}
td.num,th.num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.table-wrap{overflow-x:auto}
.tl td{text-align:center;font:12px var(--mono)}
.tl td.sk{text-align:left;font:14px var(--font)}
.tl .v{display:inline-block;min-width:26px;border-radius:4px;padding:1px 4px}
iframe.resume{width:100%;height:900px;border:1px solid var(--rule);border-radius:12px;background:#fff}
.toast{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));background:var(--ink);color:var(--bg);padding:10px 14px;border-radius:8px;font-size:14px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const SCRIPT = String.raw`
(function(){
var D=JSON.parse(document.getElementById("tf-data").textContent);
var S=JSON.parse(document.getElementById("tf-strings").textContent);
var TOKEN=document.querySelector('meta[name="tf-token"]');TOKEN=TOKEN&&TOKEN.content;
var app=document.getElementById("app");
function h(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function dur(min){if(!min)return "0"+S.minutesShort;var hr=Math.floor(min/60),m=min%60;return hr?hr+S.hoursShort+(m?" "+m+S.minutesShort:""):m+S.minutesShort}
function fmtDay(d){try{return new Date(d+"T12:00:00").toLocaleDateString(D.lang==="tr"?"tr-TR":"en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}catch(e){return d}}
var byDay={};D.activities.forEach(function(a){(byDay[a.date]=byDay[a.date]||[]).push(a)});
var insights={};D.insights.forEach(function(i){insights[i.date]=i});
var events={};D.events.forEach(function(e){events[e.id]=e});
var days=Object.keys(byDay).concat(Object.keys(insights)).filter(function(v,i,a){return a.indexOf(v)===i}).sort().reverse();
function totals(list){var t={min:0,prompts:0,commits:0,projects:{}};(list||[]).forEach(function(a){t.min+=a.activeMinutes;t.prompts+=a.promptCount;t.commits+=a.commits.length;t.projects[a.project]=1});t.projectCount=Object.keys(t.projects).length;return t}
function chips(list){return list&&list.length?'<ul class="chips">'+list.map(function(s){return "<li>"+h(s)+"</li>"}).join("")+"</ul>":""}
function kpis(t){return '<div class="kpis"><div class="kpi"><b>'+dur(t.min)+'</b><span>'+S.activeTime+'</span></div><div class="kpi"><b>'+t.prompts+'</b><span>'+S.prompts+'</span></div><div class="kpi"><b>'+t.commits+'</b><span>'+S.commits+'</span></div><div class="kpi"><b>'+t.projectCount+'</b><span>'+S.projects+'</span></div></div>'}
function reviewControls(id){
  var e=events[id];if(!e)return "";
  var pill='<span class="pill '+e.status+'">'+h(S.status[e.status]||e.status)+"</span>";
  if(e.status!=="draft")return '<div class="actions">'+pill+"</div>";
  if(TOKEN)return '<div class="actions">'+pill+'<button class="primary" data-review="'+id+'" data-status="reviewed">'+S.approve+'</button><button data-review="'+id+'" data-status="published">'+S.publish+'</button><button data-review="'+id+'" data-status="rejected">'+S.reject+"</button></div>";
  return '<div class="actions">'+pill+'</div><code class="cmd">tracefolio review '+h(id)+' --status reviewed</code>';
}
function suggestionHtml(s){
  return '<div class="sugg"><div class="sugg-head"><strong>'+h(s.title)+"</strong>"+(s.project?'<span class="muted">'+h(s.project)+"</span>":"")+"</div>"+(s.summary?"<p>"+h(s.summary)+"</p>":"")+chips(s.skills)+(s.eventId?reviewControls(s.eventId):"")+"</div>";
}
function insightCard(day){
  var i=insights[day];
  if(!i)return "";
  return '<div class="card"><div class="sugg-head"><h3 style="margin:0">'+S.summary+'</h3><span class="badge">'+(i.engine==="claude"?S.engineClaude:S.engineRules)+'</span></div><p class="lede" style="margin-top:10px">'+h(i.summary)+"</p>"+(i.highlights.length?'<h3 style="margin-top:16px">'+S.highlights+'</h3><ul class="plain">'+i.highlights.map(function(x){return "<li>"+h(x)+"</li>"}).join("")+"</ul>":"")+(i.skills.length?'<h3 style="margin-top:16px">'+S.skillsUsed+"</h3>"+chips(i.skills):"")+"</div>";
}
function viewToday(){
  var day=D.today,note="";
  if(!byDay[day]&&!insights[day]&&days.length){day=days[0];note='<p class="note">'+S.showingLast+" <b>"+h(fmtDay(day))+"</b></p>"}
  var t=totals(byDay[day]);var i=insights[day];
  var sugg=i&&i.suggestions.length?i.suggestions.map(suggestionHtml).join(""):'<p class="muted" style="margin:0">'+S.noSuggestions+"</p>";
  var pending=D.events.filter(function(e){return e.status==="draft"}).length;
  return '<section class="tab"><div><h2>'+h(fmtDay(day))+"</h2>"+note+"</div>"+(byDay[day]||i?kpis(t)+insightCard(day)+'<div class="card"><h3>'+S.suggestions+"</h3>"+sugg+(pending?'<p class="note" style="margin-top:14px"><a href="#cv">'+S.pending+": "+pending+" →</a></p>":"")+(!TOKEN&&pending?'<p class="note">'+S.staticNote+"</p>":"")+"</div>":'<div class="card">'+S.noActivity+"</div>")+"</section>";
}
function projectRows(list){
  var p={};(list||[]).forEach(function(a){var x=p[a.project]=p[a.project]||{min:0,prompts:[],promptCount:0,commits:[]};x.min+=a.activeMinutes;x.promptCount+=a.promptCount;x.prompts=x.prompts.concat(a.prompts);x.commits=x.commits.concat(a.commits)});
  return Object.keys(p).sort(function(a,b){return p[b].min-p[a].min}).map(function(k){var x=p[k];
    return '<div class="proj-row"><div><strong>'+h(k)+"</strong>"+(x.commits.length?'<ul class="plain muted" style="font-size:14px">'+x.commits.slice(0,6).map(function(c){return "<li>"+h(c.subject)+"</li>"}).join("")+(x.commits.length>6?"<li>…</li>":"")+"</ul>":"")+(x.prompts.length?"<details><summary>"+S.showPrompts+" ("+x.prompts.length+")</summary><ol>"+x.prompts.map(function(q){return "<li>"+h(q)+"</li>"}).join("")+"</ol></details>":"")+'</div><div class="nums">'+dur(x.min)+"<br>"+x.promptCount+" "+S.prompts+"<br>"+x.commits.length+" "+S.commits+"</div></div>"}).join("");
}
function viewDays(){
  return '<section class="tab">'+days.slice(0,60).map(function(d){var i=insights[d];var t=totals(byDay[d]);
    return '<article class="card day" id="day-'+d+'"><div class="day-head"><h2>'+h(fmtDay(d))+'</h2><span class="muted" style="font-size:13px">'+dur(t.min)+" · "+t.prompts+" "+S.prompts+" · "+t.commits+" "+S.commits+"</span></div>"+(i?'<p style="margin:0">'+h(i.summary)+"</p>":'<p class="muted" style="margin:0">'+S.noInsight+"</p>")+(byDay[d]?"<div>"+projectRows(byDay[d])+"</div>":"")+"</article>"}).join("")+"</section>";
}
function level(min){return !min?0:min<30?1:min<90?2:min<180?3:4}
function viewCalendar(){
  var end=new Date(D.today+"T12:00:00");var start=new Date(end);start.setDate(start.getDate()-7*26);start.setDate(start.getDate()-((start.getDay()+6)%7));
  var cells="",d=new Date(start),active=[];
  while(d<=end||((d.getDay()+6)%7)!==0){var key=d.toISOString().slice(0,10);var loc=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);var t=totals(byDay[loc]);var fut=d>end;
    cells+='<button class="cell l'+level(t.min)+(fut?" future":"")+'" title="'+h(loc+": "+dur(t.min)+", "+t.prompts+" "+S.prompts+", "+t.commits+" "+S.commits)+'" data-day="'+loc+'" aria-label="'+h(loc)+'"></button>';
    if(t.min||t.commits)active.push(loc);d.setDate(d.getDate()+1)}
  function countSince(n){var c=new Date(end);c.setDate(c.getDate()-n);var lim=c.toISOString().slice(0,10);return Object.keys(byDay).filter(function(x){return x>lim&&x<=D.today}).length}
  var sorted=Object.keys(byDay).sort(),best=0,run=0,prev=null;sorted.forEach(function(x){var dd=new Date(x+"T12:00:00");if(prev&&(dd-prev)/864e5<1.5)run++;else run=1;best=Math.max(best,run);prev=dd});
  var wk=new Date(end);wk.setDate(wk.getDate()-((wk.getDay()+6)%7));var wkKey=wk.toISOString().slice(0,10);var weekMin=0;Object.keys(byDay).forEach(function(x){if(x>=wkKey&&x<=D.today)weekMin+=totals(byDay[x]).min});
  var proj={};D.activities.forEach(function(a){var p=proj[a.project]=proj[a.project]||{days:{},min:0,last:""};p.days[a.date]=1;p.min+=a.activeMinutes;if(a.date>p.last)p.last=a.date});
  var rows=Object.keys(proj).sort(function(a,b){return proj[b].last.localeCompare(proj[a].last)}).map(function(k){var p=proj[k];return "<tr><td>"+h(k)+'</td><td class="num">'+Object.keys(p.days).length+'</td><td class="num">'+dur(p.min)+'</td><td class="num">'+h(p.last)+"</td></tr>"}).join("");
  return '<section class="tab"><div class="kpis"><div class="kpi"><b>'+countSince(30)+'</b><span>'+S.activeDays30+'</span></div><div class="kpi"><b>'+countSince(90)+'</b><span>'+S.activeDays90+'</span></div><div class="kpi"><b>'+best+" "+S.days+'</b><span>'+S.streak+'</span></div><div class="kpi"><b>'+dur(weekMin)+'</b><span>'+S.thisWeek+'</span></div></div><div class="card"><div class="heat-wrap"><div class="heat-row"><div class="heat-axis">'+S.weekdays.map(function(w){return "<span>"+w+"</span>"}).join("")+'</div><div class="heat">'+cells+'</div></div></div><div class="legend">'+S.less+' <i style="background:var(--h0)"></i><i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4)"></i> '+S.more+'</div></div><div class="card"><h3>'+S.byProject+'</h3><div class="table-wrap"><table><thead><tr><th>'+S.projects+'</th><th class="num">'+S.days+'</th><th class="num">'+S.activeTime+'</th><th class="num">'+S.lastWorked+"</th></tr></thead><tbody>"+rows+"</tbody></table></div></div></section>";
}
function viewCv(){
  var drafts=D.events.filter(function(e){return e.status==="draft"});
  var list=drafts.length?drafts.map(function(e){return '<div class="sugg"><div class="sugg-head"><strong>'+h(e.title)+'</strong><span class="muted">'+h(e.project||"")+"</span></div>"+(e.summary?"<p>"+h(e.summary.split("\n").slice(0,3).join(" · "))+"</p>":"")+chips(e.skills)+reviewControls(e.id)+"</div>"}).join(""):'<p class="muted" style="margin:0">'+S.noPending+"</p>";
  return '<section class="tab"><div class="card"><h3>'+S.pending+" ("+drafts.length+")</h3>"+list+(!TOKEN&&drafts.length?'<p class="note" style="margin-top:12px">'+S.staticNote+"</p>":"")+'</div><div><h2>'+S.resume+'</h2><p class="note">'+S.resumeNote+'</p></div><iframe class="resume" title="'+S.resume+'" sandbox="" srcdoc="'+h(D.resumeHtml)+'"></iframe></section>';
}
function viewCareer(){
  var r=D.report;
  var rep=r?'<div class="grid"><div class="card"><h3>'+S.strengths+"</h3>"+(r.strengths.length?'<ul class="plain">'+r.strengths.map(function(s){return "<li><b>"+h(s.area)+"</b>: "+h(s.evidence)+"</li>"}).join("")+"</ul>":'<p class="muted">—</p>')+'</div><div class="card"><h3>'+S.nextSteps+"</h3>"+(r.nextSteps.length?'<ol class="plain" style="padding-left:20px;margin:0">'+r.nextSteps.map(function(s){return "<li>"+h(s)+"</li>"}).join("")+"</ol>":'<p class="muted">—</p>')+'</div></div><div class="card"><h3>'+S.gaps+'</h3><div class="table-wrap"><table><tbody>'+r.gaps.map(function(g){return "<tr><td><b>"+h(g.area)+'</b><div class="muted" style="font-size:13px">'+h(g.why)+"</div></td><td>"+h(g.action)+"</td></tr>"}).join("")+"</tbody></table></div></div>":'<div class="card">'+S.noReport+"</div>";
  var cov='<div class="card"><h3>'+S.coverage+'</h3><p class="note" style="margin-bottom:8px">'+S.coverageNote+'</p><div class="table-wrap"><table><tbody>'+D.coverage.map(function(c){return "<tr><td><b>"+h(c.area)+'</b></td><td><span class="pill '+c.status+'">'+S.covStatus[c.status]+"</span></td><td>"+h(c.onResume.concat(c.inPractice).join(", ")||"—")+'</td><td class="muted" style="font-size:13px">'+(c.status==="strong"?"":h(c.action))+"</td></tr>"}).join("")+"</tbody></table></div></div>";
  var pg=D.profileGaps.length?'<div class="card"><h3>'+S.profileGaps+'</h3><ul class="plain">'+D.profileGaps.map(function(g){return "<li><b>"+h(g.area)+"</b>: "+h(g.why)+" "+h(g.action)+"</li>"}).join("")+"</ul></div>":"";
  var months=[];var m=new Date(D.today+"T12:00:00");m.setDate(1);for(var k=5;k>=0;k--){var x=new Date(m);x.setMonth(m.getMonth()-k);months.push(x.toISOString().slice(0,7))}
  var sk={};D.activities.forEach(function(a){var mo=a.date.slice(0,7);if(months.indexOf(mo)<0)return;a.skills.forEach(function(s){var o=sk[s]=sk[s]||{total:0};o[mo]=o[mo]||{};o[mo][a.date]=1})});
  Object.keys(sk).forEach(function(s){sk[s].total=months.reduce(function(n,mo){return n+(sk[s][mo]?Object.keys(sk[s][mo]).length:0)},0)});
  var top=Object.keys(sk).sort(function(a,b){return sk[b].total-sk[a].total}).slice(0,14);
  var maxV=1;top.forEach(function(s){months.forEach(function(mo){maxV=Math.max(maxV,sk[s][mo]?Object.keys(sk[s][mo]).length:0)})});
  var tl=top.length?'<div class="card"><h3>'+S.timeline+'</h3><div class="table-wrap"><table class="tl"><thead><tr><th></th>'+months.map(function(mo){return "<th>"+mo+"</th>"}).join("")+"</tr></thead><tbody>"+top.map(function(s){return '<tr><td class="sk">'+h(s)+"</td>"+months.map(function(mo){var v=sk[s][mo]?Object.keys(sk[s][mo]).length:0;var lv=v?Math.min(4,Math.ceil(v/maxV*4)):0;return '<td><span class="v" style="background:var(--h'+lv+");color:"+(lv>=3?"var(--surface)":"var(--ink)")+'">'+(v||"")+"</span></td>"}).join("")+"</tr>"}).join("")+"</tbody></table></div></div>":"";
  return '<section class="tab"><div><p class="note">'+S.role+": <b>"+h(D.targetRole)+"</b></p>"+(r&&r.headline?"<h2 style=\"margin-top:6px\">"+h(r.headline)+'</h2><p class="note">'+S.headline+"</p>":"")+"</div>"+rep+cov+pg+tl+"</section>";
}
var views={today:viewToday,days:viewDays,calendar:viewCalendar,cv:viewCv,career:viewCareer};
function route(){var key=(location.hash||"#today").slice(1);var day=null;if(key.indexOf("day-")===0){day=key;key="days"}if(!views[key])key="today";
  document.querySelectorAll("nav.tabs a").forEach(function(a){if(a.getAttribute("href")==="#"+key)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  app.innerHTML=views[key]();if(day){var el=document.getElementById(day);if(el)el.scrollIntoView()}else window.scrollTo(0,0)}
function toast(msg){var t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},1800)}
app.addEventListener("click",function(ev){
  var cell=ev.target.closest("[data-day]");if(cell){location.hash="day-"+cell.getAttribute("data-day");return}
  var b=ev.target.closest("[data-review]");if(!b||!TOKEN)return;
  var id=b.getAttribute("data-review"),status=b.getAttribute("data-status");
  b.parentNode.querySelectorAll("button").forEach(function(x){x.disabled=true});
  fetch("api/review",{method:"POST",headers:{"content-type":"application/json","x-tracefolio-token":TOKEN},body:JSON.stringify({id:id,status:status})})
    .then(function(r){if(!r.ok)throw new Error();return r.json()})
    .then(function(res){events[id].status=res.status;D.resumeHtml=res.resumeHtml||D.resumeHtml;toast(S.saved);route()})
    .catch(function(){toast(S.failed);b.parentNode.querySelectorAll("button").forEach(function(x){x.disabled=false})});
});
addEventListener("hashchange",route);route();
})();
`;

/** JSON safe to embed inside a <script> element. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** A self-contained dashboard page. Pass a token to enable review buttons (served mode). */
export function renderDashboard(data: DashboardData, options: { token?: string } = {}): string {
  const s = STRINGS[data.lang];
  const tabs = Object.entries(s.tabs)
    .map(([key, label]) => `<a href="#${key}">${esc(label)}</a>`)
    .join("");
  const updated = new Date(data.generatedAt).toLocaleString(data.lang === "tr" ? "tr-TR" : "en-GB");
  return `<!doctype html>
<html lang="${data.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(s.title)} · ${esc(data.person.name || "Tracefolio")}</title>
${options.token ? `<meta name="tf-token" content="${esc(options.token)}">` : ""}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <div class="top-row"><h1>${esc(data.person.name || "Tracefolio")}</h1><span class="meta">${esc(s.title)} · ${esc(s.updated)}: ${esc(updated)}</span></div>
  <nav class="tabs" aria-label="${esc(s.title)}">${tabs}</nav>
</div></header>
<main class="wrap" id="app"></main>
<script type="application/json" id="tf-data">${embedJson(data)}</script>
<script type="application/json" id="tf-strings">${embedJson(s)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
