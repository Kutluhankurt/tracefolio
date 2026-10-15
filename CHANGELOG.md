# Changelog

## 0.2.0 — 2026-10-15

Daily career assistant.

- Opt-in collection of Claude Code and Codex session activity: project, active time, edited files, tools, and your own prompts (redacted, truncated; or counts only)
- `tracefolio daily`: collects activity, writes a daily summary, suggests resume entries as drafts, back-fills past days, rebuilds everything and sends a desktop notification
- Insights engine: `claude -p` (opt-in) or fully offline local rules, with schema-validated output and no invented metrics
- Career report: strengths, gaps for a target role, next steps, skill map and skill growth over time
- `tracefolio dashboard`: Today, Daily log, Calendar heatmap, Resume and Career tabs, with one-click review served only on localhost (token- and Host-checked)
- Fix: commits are de-duplicated by hash across renamed repository copies
- Fix: a folder wrapping a single repository is treated as that project

## 0.1.0 — 2026-10-15

First public release: the "Local Career Profile MVP".

- `tracefolio` CLI: `init`, `analyze`, `update`, `review`, `status`, `validate`, `project`, `build`, `portfolio build|dev`, `integrate`
- Zod-validated `profile.json` and append-only `events.jsonl` store
- Git analysis: author filtering, weekly/daily/per-commit grouping, de-duplication, sensitive-file filtering, secret redaction, skill inference
- Review workflow with per-record status and separately verified impact metrics
- ATS-friendly Markdown resume, print-ready HTML resume, and a static animated portfolio with light and dark themes
- Claude Code skills and a Codex `AGENTS.md` integration
- Fictional demo profile, Vitest suite and CI
