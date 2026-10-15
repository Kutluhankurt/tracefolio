---
name: tracefolio-capture-work
description: Record the work just completed in this session as a draft Tracefolio career event, linked to commits or files as evidence. Use when the user finishes a meaningful piece of work (a feature, fix, migration, investigation) and wants it in their career record, or says "capture this", "log this work", "add this to my portfolio/CV/Tracefolio".
---

# Capture work into Tracefolio

Tracefolio keeps a local, evidence-backed career record. Your job is to turn
the work done in this session into **one draft career event**. The user
approves it later with `tracefolio review`; you never approve on their behalf.

## Rules

- Describe only work that actually happened in this session or is visible in
  the repository. Do not invent scope, users, teams or results.
- **Never invent metrics.** Leave `impact.metric` null unless the user gave you
  a measured number. Never set `impact.verified` to true.
- Always create the event as `draft`. Do not pass `--status`.
- Do not include secrets, credentials, customer names or private data in the
  title or summary. If the work is under NDA, keep the summary generic and ask.
- Show the user the event you are about to record and get a yes before running
  the command.

## Steps

1. Check the CLI is available: `tracefolio --version`. If it is not, tell the
   user to install Tracefolio (see its README) and stop.
2. Gather evidence: the commits you made or that cover this work
   (`git log --oneline -n 10`), plus any PR/issue URLs the user mentioned.
3. Draft the event:
   - `title`: what was achieved, in under 12 words, starting with a verb.
   - `summary`: 1–3 sentences on the problem, the approach and the result.
   - `skills`: 2–6 concrete technologies or practices actually used.
   - `project`: a lowercase slug for the project (usually the repo name).
4. Show it to the user and ask for confirmation.
5. Record it (one `--commit` flag per commit; `--repo` points at the repo):

   ```bash
   tracefolio update \
     --title "Add retry with backoff to the device updater" \
     --summary "Replaced fixed retries with exponential backoff so flaky field links stop exhausting the queue." \
     --skills "Python,Networking,Reliability" \
     --project device-updater \
     --repo . --commit 3f2a9c1 --commit 8be41d0 \
     --source claude-code
   ```

   Use `--source codex` when running inside Codex. For an event with no
   commits, use `--url <link>` or `--note "<text>"` as evidence instead.
6. Tell the user the event id and that they can approve it with
   `tracefolio review`.

If `tracefolio update` reports that a commit is already recorded, do not force
it; the work is already captured.
