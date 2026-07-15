# Productivity Dashboard — GitHub Pages mirror

Static mirror of Shelvi's productivity dashboard, hosted on GitHub Pages so it can be opened from any device without Claude Cowork running.

- **Live URL:** https://shelmecha.github.io/productivity-dashboard/
- **Source of truth:** `C:\Users\Shelvi\Documents\Claude\Projects\AUS Operations\AUS Operations\productivity-dashboard\` — the Claude refresh skills write there, not here.

## How updates flow

1. Claude refreshes the dashboard data (hourly scheduled task, or "refresh the dashboard") — this rewrites `data.js` and `tasks/*` in the **source** folder.
2. Double-click `sync-data.bat` in this folder — it copies `index.html`, `data.js`, `data.json`, and `tasks/*` from the source folder into this repo.
3. Open GitHub Desktop → commit → push. Pages redeploys in ~1 minute.

The site only shows data as of the last push — pushing is what refreshes the live site.

## Privacy

This dashboard contains work data (HubSpot tickets, customer names, email snippets, Slack messages). The page carries `noindex, nofollow` and `robots.txt` disallows all crawlers, but on a **public** repo the data is still visible to anyone with the URL or browsing the repo. Prefer a **private repo** with GitHub Pages (requires GitHub Pro) if that's a concern.

## Files

- `index.html` — the dashboard UI (single file).
- `data.js` / `data.json` — home-page data payload.
- `tasks/*.js` / `tasks/*.json` — per-page feeds (AU Ops, OPD, Global Service CA, Radaro, Slack, 1:1 preps).
- `sync-data.bat` — copies fresh files from the source folder into this repo.
- `.nojekyll` / `robots.txt` — Pages plumbing + crawler opt-out.

## Known limits on the hosted version

- Ticks/approvals persist in that browser's `localStorage` only — they don't sync between the local copy and the hosted copy, or across devices.
- The File System Access flow (writing `tasks/opd-checklist.approvals.json`) can't write back to the repo from the hosted page — it falls back to downloading the file.
- `slack://` deep links only work on a machine with the Slack desktop app.
