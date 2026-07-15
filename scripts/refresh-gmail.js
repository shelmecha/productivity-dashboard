#!/usr/bin/env node
/**
 * Claude-free Gmail + home-counter refresher for the productivity dashboard.
 * Runs in GitHub Actions (see .github/workflows/refresh-data.yml).
 *
 * Rewrites data.json / data.js:
 *   - Gmail buckets: gmail (Reply ASAP), gmailFollowUp, waitingOn, forgotten,
 *     inboxOther, allUnread  — classified by the v0.4.0 routing tree
 *     (last-sender -> notification -> SLA-aged -> <24h -> default).
 *   - Home HubSpot counters (ausOpsSummary, globalServiceSummary,
 *     preDeliveryChecklists) — recomputed if HUBSPOT_TOKEN is present.
 *
 * Deliberate simplifications vs the Claude refresh-home skill (documented in meta):
 *   - No AI gist / draftReply (needs an LLM). Cards fall back to the email's
 *     own snippet; draftReply is null. Add an Anthropic key later to restore.
 *   - Newsletter/no-reply senders are routed to inboxOther heuristically.
 *   - "Notion SOP" follow-up rule dropped (self-contained rules only).
 *
 * Env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (required)
 *   HUBSPOT_TOKEN (optional — recomputes home counters when set)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const G = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  refresh: process.env.GOOGLE_REFRESH_TOKEN,
};
if (!G.id || !G.secret || !G.refresh) {
  console.error('Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN');
  process.exit(1);
}

const SHELVI_RE = /^shelvi[a-z0-9.+_-]*@withbureau\.com$/i; // shelvi@, shelvia@, +tag variants
const INTERNAL_DOMAINS = ['withbureau.com', 'inboxbooths.com'];
const BOT_HINTS = /(no[-_.]?reply|noreply|notifications?|newsletter|mailer|do[-_.]?not[-_.]?reply|updates?@|marketing@|@.*\.mailchimp|@sendgrid|@substack)/i;
const HS_TASK_HINTS = [
  "you've been assigned the task", 'your ', 'part tracking number',
  'new rectification ticket assigned', 'tasks:', 'tasks due',
];

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

async function accessToken() {
  const body = new URLSearchParams({
    client_id: G.id, client_secret: G.secret,
    refresh_token: G.refresh, grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error('Google token refresh failed: ' + JSON.stringify(j).slice(0, 300));
  }
  return j.access_token;
}

async function gmail(token, url) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me' + url, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1200 * (a + 1))); continue; }
    if (!r.ok) throw new Error(`Gmail ${r.status} on ${url}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error('Gmail retries exhausted on ' + url);
}

function header(headers, name) {
  const h = (headers || []).find(x => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}
function parseAddr(v) {
  const m = String(v || '').match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(v || '').trim().toLowerCase() };
}
function isShelvi(email) { return SHELVI_RE.test(String(email || '')); }
function domainOf(email) { const m = String(email || '').split('@'); return m[1] || ''; }
function isInternal(email) { return INTERNAL_DOMAINS.includes(domainOf(email)); }

function classify(latest, allMsgs, ageHours) {
  const from = parseAddr(header(latest.payload.headers, 'From'));
  const subject = header(latest.payload.headers, 'Subject').toLowerCase();
  // Last sender is Shelvi -> she's waiting on the other side.
  if (isShelvi(from.email)) return 'waitingOn';
  // HubSpot / task-notification -> follow up.
  const isNotif = from.email.includes('notifications.hubspot.com') ||
    HS_TASK_HINTS.some(h => subject.includes(h));
  if (isNotif) return 'gmailFollowUp';
  // Aged past SLA with no Shelvi reply after -> forgotten.
  const shelviReplied = allMsgs.some(m => {
    const f = parseAddr(header(m.payload.headers, 'From'));
    return isShelvi(f.email) && Number(m.internalDate) > Number(latest.internalDate);
  });
  const slaHours = isInternal(from.email) ? 24 * 7 : 72; // vendor/internal ~5 biz days, client 72h
  if (!shelviReplied && ageHours > slaHours) return 'forgotten';
  // Newsletter / no-reply noise -> Other.
  if (BOT_HINTS.test(from.email)) return 'inboxOther';
  // Recent external -> Reply ASAP.
  if (ageHours <= 24) return 'gmail';
  // Everything else external, not yet at SLA -> follow up.
  return 'gmailFollowUp';
}

/* ---- optional HubSpot home counters ---- */
const HS = 'https://api.hubapi.com';
async function hsCount(filters) {
  const r = await fetch(HS + '/crm/v3/objects/tickets/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups: [{ filters }], properties: ['subject'], limit: 1 }),
  });
  if (!r.ok) throw new Error('HubSpot ' + r.status);
  return (await r.json()).total || 0;
}
async function homeCounters(today) {
  if (!process.env.HUBSPOT_TOKEN) return null;
  const P_OPS = '749963562', P_SVC = '768255583';
  const [aus, svc] = await Promise.all([
    hsCount([
      { propertyName: 'hs_pipeline', operator: 'EQ', value: P_OPS },
      { propertyName: 'hs_pipeline_stage', operator: 'EQ', value: '1105295898' },
      { propertyName: 'country_region', operator: 'EQ', value: 'Australia' },
    ]),
    hsCount([
      { propertyName: 'hs_pipeline', operator: 'EQ', value: P_SVC },
      { propertyName: 'hubspot_owner_id', operator: 'EQ', value: '1558931538' },
      { propertyName: 'hs_pipeline_stage', operator: 'NOT_IN', values: ['1123638123', '1314053420'] },
    ]),
  ]);
  return { aus, svc };
}

(async () => {
  const token = await accessToken();
  const list = await gmail(token, '/threads?q=' + encodeURIComponent('in:inbox is:unread') + '&maxResults=100');
  const threads = list.threads || [];
  const buckets = { gmail: [], gmailFollowUp: [], waitingOn: [], forgotten: [], inboxOther: [] };
  const now = Date.now();

  for (const t of threads) {
    let full;
    try {
      full = await gmail(token, `/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`);
    } catch (e) { console.warn('thread ' + t.id + ' skipped: ' + e.message); continue; }
    const msgs = (full.messages || []).slice().sort((a, b) => Number(a.internalDate) - Number(b.internalDate));
    if (!msgs.length) continue;
    const latest = msgs[msgs.length - 1];
    const H = latest.payload.headers;

    // Shelvi must be on To (not Cc-only); drop Cc-only threads entirely.
    const toList = (header(H, 'To') + ',' + header(H, 'Cc')).toLowerCase();
    const onTo = header(H, 'To').toLowerCase();
    const shelviOnTo = /shelvi[a-z0-9.+_-]*@withbureau\.com/.test(onTo);
    const shelviAnywhere = /shelvi[a-z0-9.+_-]*@withbureau\.com/.test(toList);
    if (shelviAnywhere && !shelviOnTo) continue; // Cc-only -> drop

    const ageHours = (now - Number(latest.internalDate)) / 3600000;
    const bucket = classify(latest, msgs, ageHours);
    const from = parseAddr(header(H, 'From'));
    const receivedAt = new Date(Number(latest.internalDate)).toISOString().replace(/\.\d{3}Z$/, '+00:00');
    const row = {
      id: 'gmail-' + t.id, threadId: t.id,
      from: from.email, fromName: from.name || from.email.split('@')[0],
      subject: header(H, 'Subject') || '(no subject)',
      date: receivedAt.slice(0, 10), receivedAt,
      url: 'https://mail.google.com/mail/u/0/#inbox/' + t.id,
      bucket,
      snippet: (full.snippet || t.snippet || '').replace(/ /g, ' ').trim() || '(no preview available)',
      draftReply: null,
    };
    buckets[bucket].push(row);
  }

  const order = { gmail: 0, gmailFollowUp: 1, waitingOn: 2, forgotten: 3, inboxOther: 4 };
  const allUnread = [].concat(...Object.values(buckets))
    .sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || '') || order[a.bucket] - order[b.bucket]);

  // Merge into existing data.json (preserve HubSpot summary blocks; refresh them if token present).
  const dataPath = path.join(ROOT, 'data.json');
  let data = {};
  try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { /* fresh */ }

  Object.assign(data, buckets, { allUnread });
  data.refreshedAt = nowIso();
  data.meta = {
    refreshedAt: nowIso(), generatedAt: nowIso(),
    source: 'GitHub Actions — Gmail API (in:inbox is:unread) v0.4.0 routing tree + HubSpot counters',
    rule_version: 'v0.4.0-actions',
    note: 'Script-classified: no AI gist/draft (falls back to snippet); newsletter senders heuristically routed to Other.',
  };

  try {
    const c = await homeCounters();
    if (c) {
      data.ausOpsSummary = { newTickets: c.aus, customisationHolds: 0, lastUpdated: nowIso(), note: 'GitHub Actions HubSpot count — AU New Ticket stage.' };
      data.globalServiceSummary = { caOpenTickets: c.svc, refreshedAt: nowIso(), note: 'GitHub Actions HubSpot count — open Global Service tickets owned by Shelvi.' };
      // preDeliveryChecklists count comes from the tasks/opd-checklist feed; leave prior value if present.
    }
  } catch (e) { console.warn('home counters skipped: ' + e.message); }

  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(dataPath, json + '\n');
  fs.writeFileSync(path.join(ROOT, 'data.js'), 'window.DASHBOARD_DATA = ' + json + ';\n');

  console.log(`✓ gmail — ${allUnread.length} unread ` +
    `(ASAP ${buckets.gmail.length}, FollowUp ${buckets.gmailFollowUp.length}, ` +
    `Waiting ${buckets.waitingOn.length}, Forgotten ${buckets.forgotten.length}, Other ${buckets.inboxOther.length})`);
})().catch(e => { console.error(e); process.exit(1); });
