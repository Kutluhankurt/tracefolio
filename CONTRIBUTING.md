# Contributing to Tracefolio

Thanks for helping! Tracefolio is small on purpose, so a few principles guide every change:

1. **No fabrication.** Never add code that invents metrics, experience or claims, or that shows unapproved records.
2. **Local-first and private by default.** No network calls from the core. New outputs must go through `buildCareerModel()` in `packages/generators/src/model.ts`, which is the single place that decides what each audience may see.
3. **Provider-agnostic.** AI-specific code belongs in `packages/integrations` or `skills/`, never in `core`.
4. **Few dependencies.** Justify every new runtime dependency in the PR.

## Setup

```bash
pnpm install
pnpm build
pnpm test
```

Run the CLI from source after building with `pnpm tracefolio <command>`. Try it on the demo data with `pnpm tracefolio --home examples/demo build --out /tmp/demo`.

## Layout

| Path | Responsibility |
| --- | --- |
| `packages/core` | Zod schemas, the profile store, selection rules, privacy filters |
| `packages/git-adapter` | Reading git history, inferring skills, drafting events |
| `packages/generators` | Resume (Markdown/HTML) and static portfolio |
| `packages/integrations` | Installers for Claude Code skills and the Codex `AGENTS.md` |
| `packages/cli` | The `tracefolio` command |
| `skills/` | Agent workflow instructions (the source of truth for integrations) |
| `examples/demo` | A fictional profile used in docs and tests; keep it fictional |
| `tests/` | Vitest suites, including the end-to-end acceptance test |

## Pull requests

- Add or update tests for behavior changes. `tests/cli.test.ts` holds the end-to-end flow.
- Keep the demo profile fictional. Never commit real personal data.
- Use clear commit messages; conventional prefixes (`feat:`, `fix:`, `docs:`) are welcome.
- New agent adapter? Add it to `INTEGRATIONS` in `packages/integrations`, reuse `loadSkills()`, and add a test.

## Reporting issues

Open a GitHub issue with steps to reproduce, your Node.js version and the output of `tracefolio validate`. **Do not paste your real `events.jsonl`**; reduce it to a fictional example.
