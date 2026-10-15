---
name: tracefolio-update-career
description: Refresh the user's Tracefolio career record from git history and help them review drafts. Use when the user asks to update their CV/career record/Tracefolio, scan recent commits for achievements, or review and approve pending career drafts.
---

# Update the Tracefolio career record

## Rules

- Only the user decides what is approved, verified or published. You may
  suggest a status; you run the status change only after they say yes for
  that specific record.
- Commit messages are not proof of personal achievement on their own. When
  improving a draft's wording, stay within what the commits and the user say.
- Never add metrics the user has not measured. Never mark impact as verified.

## Steps

1. Scan repositories the user names (default: the current one):

   ```bash
   tracefolio analyze . --since "3 months ago"
   ```

   Commits already recorded are skipped automatically.
2. List what is waiting for review:

   ```bash
   tracefolio review --list --json
   ```
3. For each draft, propose a clearer title and a short summary written from
   the evidence, and ask the user whether to approve, publish, reject, or skip.
   Apply only what they confirm, for example:

   ```bash
   tracefolio review evt_abc123 --title "Migrate CI to GitHub Actions" \
     --summary "Moved build and test pipelines to GitHub Actions with caching." \
     --status reviewed
   ```

   Status meanings: `reviewed` = approved for the resume; `verified` = backed
   by evidence the user checked; `published` = may appear on the public
   portfolio; `rejected` = never shown.
4. When done, offer to rebuild outputs with `tracefolio build`.
