import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  CareerEventSchema,
  ConfigSchema,
  ProfileSchema,
  formatIssues,
  type CareerEvent,
  type CareerEventInput,
  type Config,
  type Profile,
  type ProfileInput,
  type RecordStatus,
} from "./schema.js";

export const CONFIG_FILE = "tracefolio.config.json";

export class TracefolioError extends Error {}

export function newEventId(): string {
  return `evt_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export interface ResolveHomeOptions {
  home?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * Where the career profile lives: --home, then $TRACEFOLIO_HOME, then the
 * nearest ancestor of cwd containing tracefolio.config.json, then ~/.tracefolio.
 */
export function resolveHome(options: ResolveHomeOptions = {}): string {
  const env = options.env ?? process.env;
  if (options.home) return resolve(options.home);
  if (env.TRACEFOLIO_HOME) return resolve(env.TRACEFOLIO_HOME);
  let dir = resolve(options.cwd ?? process.cwd());
  for (;;) {
    if (existsSync(join(dir, CONFIG_FILE))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(homedir(), ".tracefolio");
}

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${randomBytes(3).toString("hex")}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, path);
}

export class ProfileStore {
  readonly home: string;

  constructor(home: string) {
    this.home = resolve(home);
  }

  get configPath(): string {
    return join(this.home, CONFIG_FILE);
  }
  get profilePath(): string {
    return join(this.home, "profile", "profile.json");
  }
  get eventsPath(): string {
    return join(this.home, "profile", "events.jsonl");
  }
  get outDir(): string {
    return join(this.home, "out");
  }

  isInitialized(): boolean {
    return existsSync(this.configPath) && existsSync(this.profilePath);
  }

  assertInitialized(): void {
    if (!this.isInitialized()) {
      throw new TracefolioError(`No Tracefolio profile at ${this.home}. Run \`tracefolio init\` first.`);
    }
  }

  async init(profile: ProfileInput, options: { force?: boolean } = {}): Promise<void> {
    if (this.isInitialized() && !options.force) {
      throw new TracefolioError(`A Tracefolio profile already exists at ${this.home} (use --force to overwrite).`);
    }
    await writeAtomic(this.configPath, `${JSON.stringify(ConfigSchema.parse({}), null, 2)}\n`);
    await this.writeProfile(ProfileSchema.parse(profile));
    if (!existsSync(this.eventsPath) || options.force) await writeAtomic(this.eventsPath, "");
    await writeAtomic(join(this.home, ".gitignore"), "out/\n.env\n.env.*\n");
  }

  async readConfig(): Promise<Config> {
    if (!existsSync(this.configPath)) return ConfigSchema.parse({});
    const parsed = ConfigSchema.safeParse(JSON.parse(await readFile(this.configPath, "utf8")));
    if (!parsed.success) throw new TracefolioError(`Invalid ${CONFIG_FILE}: ${formatIssues(parsed.error)}`);
    return parsed.data;
  }

  async writeConfig(config: Config): Promise<void> {
    const parsed = ConfigSchema.safeParse(config);
    if (!parsed.success) throw new TracefolioError(`Invalid config: ${formatIssues(parsed.error)}`);
    await writeAtomic(this.configPath, `${JSON.stringify(parsed.data, null, 2)}\n`);
  }

  async readProfile(): Promise<Profile> {
    this.assertInitialized();
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(this.profilePath, "utf8"));
    } catch (err) {
      throw new TracefolioError(`Cannot read ${this.profilePath}: ${(err as Error).message}`);
    }
    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) throw new TracefolioError(`Invalid profile.json: ${formatIssues(parsed.error)}`);
    return parsed.data;
  }

  async writeProfile(profile: Profile): Promise<void> {
    const parsed = ProfileSchema.safeParse(profile);
    if (!parsed.success) throw new TracefolioError(`Invalid profile: ${formatIssues(parsed.error)}`);
    await writeAtomic(this.profilePath, `${JSON.stringify(parsed.data, null, 2)}\n`);
  }

  async readEvents(): Promise<CareerEvent[]> {
    this.assertInitialized();
    if (!existsSync(this.eventsPath)) return [];
    const lines = (await readFile(this.eventsPath, "utf8")).split("\n");
    const events: CareerEvent[] = [];
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new TracefolioError(`events.jsonl line ${index + 1}: invalid JSON`);
      }
      const parsed = CareerEventSchema.safeParse(raw);
      if (!parsed.success) {
        throw new TracefolioError(`events.jsonl line ${index + 1}: ${formatIssues(parsed.error)}`);
      }
      events.push(parsed.data);
    });
    return events;
  }

  private validate(input: CareerEventInput): CareerEvent {
    const parsed = CareerEventSchema.safeParse(input);
    if (!parsed.success) throw new TracefolioError(`Invalid career event: ${formatIssues(parsed.error)}`);
    return parsed.data;
  }

  async appendEvents(inputs: CareerEventInput[]): Promise<CareerEvent[]> {
    this.assertInitialized();
    const events = inputs.map((e) => this.validate(e));
    const existing = new Set((await this.readEvents()).map((e) => e.id));
    for (const e of events) {
      if (existing.has(e.id)) throw new TracefolioError(`Duplicate event id ${e.id}`);
      existing.add(e.id);
    }
    if (events.length > 0) {
      await appendFile(this.eventsPath, events.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
    }
    return events;
  }

  async writeEvents(inputs: CareerEventInput[]): Promise<void> {
    const events = inputs.map((e) => this.validate(e));
    await writeAtomic(this.eventsPath, events.map((e) => `${JSON.stringify(e)}\n`).join(""));
  }

  async updateEvent(id: string, patch: (event: CareerEvent) => CareerEventInput): Promise<CareerEvent> {
    const events = await this.readEvents();
    const index = findEventIndex(events, id);
    const updated = this.validate({ ...patch(events[index]!), id: events[index]!.id, updatedAt: nowIso() });
    events[index] = updated;
    await this.writeEvents(events);
    return updated;
  }

  async setStatus(id: string, status: RecordStatus): Promise<CareerEvent> {
    return this.updateEvent(id, (e) => ({ ...e, status }));
  }
}

/** Find an event by exact id or by a unique id prefix. */
export function findEventIndex(events: CareerEvent[], id: string): number {
  const exact = events.findIndex((e) => e.id === id);
  if (exact !== -1) return exact;
  const matches = events.flatMap((e, i) => (e.id.startsWith(id) ? [i] : []));
  if (matches.length === 0) throw new TracefolioError(`No event with id ${id}`);
  if (matches.length > 1) throw new TracefolioError(`Id prefix ${id} is ambiguous (${matches.length} matches)`);
  return matches[0]!;
}

/** Keys of commits already referenced by any stored event (including rejected ones). */
export function referencedCommits(events: CareerEvent[]): Set<string> {
  const set = new Set<string>();
  for (const event of events) {
    for (const ev of event.evidence) {
      if (ev.type === "git_commit") set.add(commitKey(ev.commit));
    }
  }
  return set;
}

/**
 * A commit is the same piece of work in every clone, fork or renamed copy of a
 * repository, so de-duplication keys on the hash alone. Hashes may be stored
 * abbreviated, so keys compare on git's minimum short-hash length.
 */
export function commitKey(commit: string): string {
  return commit.slice(0, 7).toLowerCase();
}
