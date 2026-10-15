import type { CareerEvent, Profile, RecordStatus } from "./schema.js";
import { APPROVED_STATUSES, PUBLIC_STATUSES } from "./schema.js";

export type Audience = "resume" | "portfolio";

/** Statuses an audience is allowed to see: resumes need approval, portfolios need publishing. */
export function statusesFor(audience: Audience): readonly RecordStatus[] {
  return audience === "portfolio" ? PUBLIC_STATUSES : APPROVED_STATUSES;
}

export function eventDate(event: CareerEvent): string {
  return event.period?.end ?? event.createdAt;
}

export function selectEvents(events: CareerEvent[], audience: Audience): CareerEvent[] {
  const allowed = statusesFor(audience);
  return events
    .filter((e) => allowed.includes(e.status))
    .sort((a, b) => eventDate(b).localeCompare(eventDate(a)));
}

/** Skills ranked by how many selected events demonstrate them, then profile-declared skills. */
export function rankSkills(profile: Profile, events: CareerEvent[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const event of events) {
    for (const skill of event.skills) {
      const key = skill.toLowerCase();
      const entry = counts.get(key) ?? { name: skill, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  }
  for (const skill of profile.skills) {
    if (!counts.has(skill.toLowerCase())) counts.set(skill.toLowerCase(), { name: skill, count: 0 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((s) => s.name);
}

/**
 * The only impact text that may be shown: a metric the user verified.
 * Unverified metrics are never rendered.
 */
export function displayableImpact(event: CareerEvent): string | null {
  return event.impact.verified && event.impact.metric ? event.impact.metric : null;
}
