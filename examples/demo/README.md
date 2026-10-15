# Demo profile

A **fictional** Tracefolio home used for documentation, screenshots and tests.
None of the people, companies, projects or numbers here are real.

```bash
pnpm tracefolio --home examples/demo status
pnpm tracefolio --home examples/demo build --out /tmp/tracefolio-demo
```

Things it demonstrates:

- `evt_demo0001` has a **verified** impact metric, so it is shown.
- `evt_demo0003` has an **unverified** metric, so the metric is hidden everywhere.
- `evt_demo0004` is `reviewed` (resume only) and `evt_demo0005` is a `draft` (shown nowhere).
- `fleet-updater` is private: the portfolio shows no commit hashes or repository links for it.
