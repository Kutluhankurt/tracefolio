---
name: tracefolio-generate-portfolio
description: Build the user's resume and static portfolio site from their approved Tracefolio records, and help them fill in project stories. Use when the user asks to generate, rebuild or preview their CV, resume or portfolio with Tracefolio.
---

# Generate resume and portfolio with Tracefolio

## Steps

1. Check readiness: `tracefolio status`. If nothing is approved yet, suggest
   running `tracefolio review` first; resumes only include approved records and
   the portfolio only includes **published** ones.
2. Build everything:

   ```bash
   tracefolio build --format all
   ```

   This writes `out/resume.md`, `out/resume.html` (print to PDF from a
   browser) and `out/portfolio/` under the Tracefolio home. Report any ATS
   warnings it prints.
3. Preview the portfolio: `tracefolio portfolio dev` and share the local URL.
4. Project pages read their story (problem, role, approach, implementation,
   outcome) from `profile/profile.json` under `projects[].story`. Offer to
   draft these from the user's description of the project. Write only what
   the user confirms, then validate with `tracefolio validate`.

## Rules

- Do not edit `events.jsonl` by hand; use the CLI.
- Do not publish the portfolio anywhere. Deploying it is the user's decision.
- Private projects never show repository links or commit hashes on the
  portfolio; do not work around this.

## Daily dashboard

If the user asks what they did today, how their career is progressing, or what
they are missing for a role, run `tracefolio daily` (or `tracefolio insights`
for one day) and then `tracefolio dashboard`. Summarise the Today and Career
tabs for them; do not approve the suggested drafts on their behalf.
