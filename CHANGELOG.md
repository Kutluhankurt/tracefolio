# Changelog

## 0.1.0 — 2026-10-15

First public release: the "Local Career Profile MVP".

- `tracefolio` CLI: `init`, `analyze`, `update`, `review`, `status`, `validate`, `project`, `build`, `portfolio build|dev`, `integrate`
- Zod-validated `profile.json` and append-only `events.jsonl` store
- Git analysis: author filtering, weekly/daily/per-commit grouping, de-duplication, sensitive-file filtering, secret redaction, skill inference
- Review workflow with per-record status and separately verified impact metrics
- ATS-friendly Markdown resume, print-ready HTML resume, and a static animated portfolio with light and dark themes
- Claude Code skills and a Codex `AGENTS.md` integration
- Fictional demo profile, Vitest suite and CI
