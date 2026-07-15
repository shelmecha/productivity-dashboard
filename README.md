# Productivity Dashboard

A single-page operations dashboard that pulls live from HubSpot and Gmail, **refreshes itself every hour via GitHub Actions**, and publishes to GitHub Pages. No server, no hosting cost, no tool left open — it stays current with the laptop closed.

- **Live URL:** https://shelmecha.github.io/productivity-dashboard/

## How it works

A scheduled GitHub Actions workflow pulls the data on the cloud, commits it, and GitHub Pages redeploys automatically.

```
HubSpot API ─┐
             ├─▶ GitHub Actions (hourly cron) ─▶ commit data ─▶ GitHub Pages ─▶ any device
Gmail API ───┘
```

1. `.github/workflows/refresh-data.yml` runs hourly (`:15` UTC) and on manual dispatch.
2. It runs two Node scripts, each gated on whether its credentials are present:
   - `scripts/refresh-hubspot.js` — rewrites the HubSpot feeds in `tasks/*`.
   - `scripts/refresh-gmail.js` — rewrites the Gmail buckets in `data.json`/`data.js` and recomputes the home HubSpot counters.
3. The workflow commits any changed data as `dashboard-bot` and pushes; Pages redeploys in ~1 minute.

There is no backend. GitHub's runners fetch the data; GitHub Pages serves the static files.

## Sections

- **Gmail** — unread inbox auto-sorted into Reply-ASAP / Follow-Up / Waiting-On / Forgotten / Other (last-sender + age rules).
- **AU Operations** — new tickets + an OPD (delivery-date) review board flagging 0–14 day, 15–21 day, and overdue risks; plus the Pre-Delivery Checklist.
- **Global Service CA** — open service tickets owned by the user, stalest first.

The dashboard is **view-only**: it displays data and lets you check items off locally. It does not send email, edit HubSpot, or take any action — those stay off the automated path by design (a static site can't hold secrets or act safely).

## Files

- `index.html` — the entire dashboard UI (single file, vanilla JS, hash routing).
- `data.json` / `data.js` — home-page payload: Gmail buckets + HubSpot counters. **Auto-generated — don't hand-edit.**
- `tasks/*.json` / `tasks/*.js` — per-page HubSpot feeds (AU Ops, OPD review, Pre-Delivery, Global Service CA). **Auto-generated.**
- `scripts/refresh-hubspot.js` — HubSpot puller (tickets, OPD windows, service queue).
- `scripts/refresh-gmail.js` — Gmail triage + home counters.
- `.github/workflows/refresh-data.yml` — the hourly refresh workflow.
- `.nojekyll` / `robots.txt` — Pages plumbing + crawler opt-out.

## Required secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | Powers | Notes |
|---|---|---|
| `HUBSPOT_TOKEN` | AU Ops, OPD, Pre-Delivery, Global Service CA, home counters | HubSpot private-app token (tickets + deals + owners read scopes) |
| `GOOGLE_CLIENT_ID` | Gmail buckets | Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | Gmail buckets | Google Cloud OAuth client |
| `GOOGLE_REFRESH_TOKEN` | Gmail buckets | OAuth2 refresh token, `gmail.modify` scope |

Each script is skipped gracefully if its credentials aren't set, so the workflow still succeeds with a partial credential set.

**Gmail OAuth note:** a Google OAuth app left in "Testing" mode issues refresh tokens that expire after 7 days. Publish the app (consent screen → "In production") so the token is long-lived.

## Adapting this for another HubSpot org

Pipeline and stage IDs in `scripts/refresh-hubspot.js` are hardcoded to one org's setup. To reuse it elsewhere, swap those IDs (and the Gmail routing rules in `refresh-gmail.js`, which encode one user's email aliases) for your own.

## Privacy

The live dashboard shows real work data (HubSpot tickets, customer names, email snippets). The page carries `noindex, nofollow` and `robots.txt` disallows crawlers, but on a **public** repo the committed data is still visible to anyone with the URL. For a public/portfolio version, run it against **fake/sample data**; for real internal use, put an access gate in front (e.g. Cloudflare Access) or use a private repo.

## Known limits

- Check-offs persist in the browser's `localStorage` only — they don't sync across devices, and they don't write back to HubSpot or Gmail (view-only by design).
- The site reflects data as of the last hourly run; trigger the workflow manually (Actions → Refresh dashboard data → Run workflow) for an immediate update.
