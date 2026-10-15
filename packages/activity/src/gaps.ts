import type { Activity, CareerEvent, Profile } from "@tracefolio/core";

export type Lang = "tr" | "en";

export function langOf(language: string): Lang {
  return language.toLowerCase().startsWith("tr") ? "tr" : "en";
}

interface Area {
  key: string;
  name: Record<Lang, string>;
  skills: string[];
  action: Record<Lang, string>;
}

/** What a hiring manager looks for, per target role. Skills match case-insensitively. */
const AI_SOFTWARE_ENGINEER: Area[] = [
  {
    key: "testing",
    name: { en: "Testing & quality", tr: "Test ve kalite" },
    skills: ["Testing", "Vitest", "pytest", "Jest", "Playwright"],
    action: {
      en: "Add automated tests to one active project and record the coverage you reach.",
      tr: "Aktif bir projene otomatik testler ekle ve ulaştığın kapsamı kaydet.",
    },
  },
  {
    key: "ci",
    name: { en: "CI/CD", tr: "CI/CD" },
    skills: ["GitHub Actions", "GitLab CI", "Jenkins", "CI/CD"],
    action: {
      en: "Set up a CI pipeline that runs tests on every push.",
      tr: "Her push'ta testleri çalıştıran bir CI hattı kur.",
    },
  },
  {
    key: "cloud",
    name: { en: "Cloud & deployment", tr: "Bulut ve dağıtım" },
    skills: ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "DigitalOcean", "Deployment", "Terraform", "Linux"],
    action: {
      en: "Containerise a project and deploy it somewhere others can reach.",
      tr: "Bir projeyi container'a al ve başkalarının erişebileceği bir yere deploy et.",
    },
  },
  {
    key: "data",
    name: { en: "Databases", tr: "Veritabanları" },
    skills: ["SQL", "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis"],
    action: {
      en: "Design a schema with migrations for a real feature instead of files or in-memory state.",
      tr: "Dosya ya da bellek yerine, gerçek bir özellik için migration'lı bir veritabanı şeması tasarla.",
    },
  },
  {
    key: "llm",
    name: { en: "LLM & AI engineering", tr: "LLM ve yapay zekâ mühendisliği" },
    skills: ["Claude API", "LLM integration", "Embeddings", "NLP", "OpenAI API", "RAG", "Machine Learning", "PyTorch", "Prompt engineering", "Claude Code"],
    action: {
      en: "Ship an LLM feature with an evaluation set, and record how quality changed.",
      tr: "Değerlendirme setiyle birlikte bir LLM özelliği yayınla ve kalitenin nasıl değiştiğini kaydet.",
    },
  },
  {
    key: "backend",
    name: { en: "Backend & APIs", tr: "Backend ve API'ler" },
    skills: ["FastAPI", "Node.js", "Express", "API design", "API integration", "Go", "Django", "Flask", "GraphQL"],
    action: {
      en: "Build and document an API with clear contracts and error handling.",
      tr: "Net sözleşmeleri ve hata yönetimi olan, dokümante edilmiş bir API geliştir.",
    },
  },
  {
    key: "frontend",
    name: { en: "Frontend", tr: "Frontend" },
    skills: ["TypeScript", "React", "Vue", "Svelte", "HTML", "CSS", "JavaScript"],
    action: {
      en: "Build an accessible UI for one of your tools.",
      tr: "Araçlarından biri için erişilebilir bir arayüz geliştir.",
    },
  },
  {
    key: "ops",
    name: { en: "Reliability & observability", tr: "Güvenilirlik ve izlenebilirlik" },
    skills: ["Reliability", "Monitoring", "Logging", "Operations", "Observability", "SRE"],
    action: {
      en: "Add monitoring and alerts to a running service and write down an incident you handled.",
      tr: "Çalışan bir servise izleme ve alarm ekle, çözdüğün bir olayı yazıya dök.",
    },
  },
  {
    key: "security",
    name: { en: "Security", tr: "Güvenlik" },
    skills: ["Security", "Authentication", "OAuth", "Encryption"],
    action: {
      en: "Add authentication or a security review to a project and record what you fixed.",
      tr: "Bir projeye kimlik doğrulama ya da güvenlik incelemesi ekle, neyi düzelttiğini kaydet.",
    },
  },
  {
    key: "design",
    name: { en: "System design", tr: "Sistem tasarımı" },
    skills: ["System design", "Architecture", "Distributed systems", "Concurrency"],
    action: {
      en: "Write a short design doc for your next feature: trade-offs, limits, alternatives.",
      tr: "Bir sonraki özelliğin için kısa bir tasarım dokümanı yaz: ödünleşimler, sınırlar, alternatifler.",
    },
  },
];

export type CoverageStatus = "strong" | "practicing" | "gap";

export interface AreaCoverage {
  key: string;
  area: string;
  status: CoverageStatus;
  /** Skills seen on approved resume records. */
  onResume: string[];
  /** Skills seen only in recent activity, not yet on the resume. */
  inPractice: string[];
  action: string;
}

const lower = (s: string) => s.toLowerCase();

/**
 * Compare demonstrated skills with the target role. "strong" means an
 * approved record proves it; "practicing" means recent activity shows it but
 * nothing on the resume does yet.
 */
export function skillCoverage(approved: CareerEvent[], activities: Activity[], lang: Lang): AreaCoverage[] {
  const resume = new Set(approved.flatMap((e) => e.skills).map(lower));
  const practice = new Set(activities.flatMap((a) => a.skills).map(lower));
  return AI_SOFTWARE_ENGINEER.map((area) => {
    const onResume = area.skills.filter((s) => resume.has(lower(s)));
    const inPractice = area.skills.filter((s) => practice.has(lower(s)) && !resume.has(lower(s)));
    const status: CoverageStatus = onResume.length ? "strong" : inPractice.length ? "practicing" : "gap";
    return { key: area.key, area: area.name[lang], status, onResume, inPractice, action: area.action[lang] };
  });
}

export interface ProfileGap {
  area: string;
  why: string;
  action: string;
}

/** Things missing from the record itself, independent of skills. */
export function profileGaps(profile: Profile, events: CareerEvent[], lang: Lang): ProfileGap[] {
  const t = (en: string, tr: string) => (lang === "tr" ? tr : en);
  const gaps: ProfileGap[] = [];
  const approved = events.filter((e) => ["reviewed", "verified", "published"].includes(e.status));
  if (!profile.person.headline) {
    gaps.push({
      area: t("Headline", "Başlık"),
      why: t("Recruiters read it first.", "İşe alımcıların ilk okuduğu satır."),
      action: t("Add a one-line headline in profile.json.", "profile.json'a tek satırlık bir başlık ekle."),
    });
  }
  if (profile.experience.length === 0) {
    gaps.push({
      area: t("Work experience", "İş deneyimi"),
      why: t("Your resume shows projects but no roles.", "CV'nde projeler var ama hiç pozisyon yok."),
      action: t("Add your current and past roles to profile.json.", "Mevcut ve önceki pozisyonlarını profile.json'a ekle."),
    });
  }
  if (profile.person.links.length === 0) {
    gaps.push({
      area: t("Links", "Linkler"),
      why: t("No GitHub or LinkedIn link to verify your work.", "İşini doğrulayacak GitHub veya LinkedIn linki yok."),
      action: t("Add GitHub and LinkedIn to person.links.", "person.links'e GitHub ve LinkedIn ekle."),
    });
  }
  if (approved.length > 0 && !approved.some((e) => e.impact.verified)) {
    gaps.push({
      area: t("Measured impact", "Ölçülmüş etki"),
      why: t("No record has a verified result yet.", "Henüz doğrulanmış sonucu olan bir kayıt yok."),
      action: t(
        "Measure one outcome (time saved, errors reduced, users) and mark it verified.",
        "Bir sonucu ölç (kazanılan zaman, azalan hata, kullanıcı sayısı) ve doğrulanmış olarak işaretle.",
      ),
    });
  }
  if (!profile.projects.some((p) => p.visibility === "public")) {
    gaps.push({
      area: t("Public work", "Açık çalışmalar"),
      why: t("Nothing a reviewer can open and inspect.", "İnceleyen birinin açıp bakabileceği bir şey yok."),
      action: t("Make one project public with a good README.", "İyi bir README ile bir projeni public yap."),
    });
  }
  const storyless = profile.projects.filter((p) => p.featured && !p.story?.problem);
  if (storyless.length) {
    gaps.push({
      area: t("Project stories", "Proje hikâyeleri"),
      why: t(`${storyless.length} featured project(s) have no story.`, `${storyless.length} öne çıkan projenin hikâyesi yok.`),
      action: t("Fill problem, role, approach and outcome for them.", "Bunlar için problem, rol, yaklaşım ve sonuç alanlarını doldur."),
    });
  }
  return gaps;
}
