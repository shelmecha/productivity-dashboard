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
 * AI summaries (optional):
 *   - When GEMINI_API_KEY is set, each email's body is summarized to one
 *     concise sentence via the Gemini API and written to row.summary. The
 *     dashboard renderer prefers item.summary and only falls back to the raw
 *     snippet when it's absent. Without the key the script still runs — cards
 *     just fall back to the snippet (cleaned client-side by deriveEmailSummary).
 *   - draftReply stays null (no reply generation here).
 *   - Newsletter/no-reply senders are routed to inboxOther heuristically.
 *
 * Env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN (required)
 *   HUBSPOT_TOKEN  (optional — recomputes home counters when set)
 *   GEMINI_API_KEY (optional — generates one-line AI summaries when set)
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

/* Decode a Gmail base64url body part to UTF-8 text. */
function decodeB64Url(data) {
  try { return Buffer.from(String(data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
  catch (e) { return ''; }
}
/* Walk a message payload and pull readable body text. Prefers text/plain;
   falls back to text/html with tags stripped. Used only to feed the summarizer. */
function extractBody(payload) {
  if (!payload) return '';
  const collect = (part, mime) => {
    let out = '';
    if (part.mimeType === mime && part.body && part.body.data) out += decodeB64Url(part.body.data);
    if (Array.isArray(part.parts)) for (const c of part.parts) out += collect(c, mime);
    return out;
  };
  let txt = collect(payload, 'text/plain');
  if (!txt.trim()) {
    const html = collect(payload, 'text/html');
    txt = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  // Strip quoted history + signatures so the summary reflects the newest message.
  txt = txt.split(/^On .+wrote:$/m)[0];
  txt = txt.replace(/\s+/g, ' ').trim();
  return txt;
}

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

/* ---- optional Gemini one-line summaries ---- */
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BATCH = 8; // emails per request — keeps payloads small + within rate limits

async function geminiSummarizeBatch(items) {
  // items: [{ id, from, subject, body }]
  const prompt =
    "You summarize emails for a busy operations manager's dashboard. " +
    "For each email, write ONE concise sentence (max ~22 words) saying what it's about " +
    "and any action needed or status. Be specific — name people, companies, tickets, " +
    "amounts, and dates when present. No greetings, no fluff, do not start with \"This email\". " +
    "If an email is an automated notification, summarize the underlying event, not the notification wrapper.\n\n" +
    "Return a JSON array of {\"id\": <number>, \"summary\": \"<text>\"} in the same order.\n\n" +
    items.map(it =>
      `[${it.id}] From: ${it.from}\nSubject: ${it.subject}\nBody: ${String(it.body || '').slice(0, 2000)}`
    ).join('\n\n---\n\n');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { id: { type: 'INTEGER' }, summary: { type: 'STRING' } },
          required: ['id', 'summary'],
        },
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  for (let a = 0; a < 3; a++) {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 2000 * (a + 1))); continue; }
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const txt = j.candidates && j.candidates[0] && j.candidates[0].content
      && j.candidates[0].content.parts && j.candidates[0].content.parts[0]
      && j.candidates[0].content.parts[0].text;
    return JSON.parse(txt || '[]');
  }
  throw new Error('Gemini retries exhausted');
}

// Summarize every row that has body text, in batches. Mutates row.summary.
// Best-effort: a failed batch logs and leaves those rows without a summary
// (the dashboard falls back to the cleaned snippet).
async function addSummaries(rows) {
  if (!process.env.GEMINI_API_KEY) { console.log('· GEMINI_API_KEY not set — skipping AI summaries'); return; }
  const targets = rows.filter(r => r._body && r._body.length > 8);
  let done = 0;
  for (let i = 0; i < targets.length; i += GEMINI_BATCH) {
    const chunk = targets.slice(i, i + GEMINI_BATCH);
    const payload = chunk.map((r, k) => ({ id: k, from: r.fromName || r.from, subject: r.subject, body: r._body }));
    try {
      const out = await geminiSummarizeBatch(payload);
      const byId = {};
      (Array.isArray(out) ? out : []).forEach(o => { if (o && typeof o.id === 'number') byId[o.id] = o.summary; });
      chunk.forEach((r, k) => { const s = byId[k]; if (s && String(s).trim()) { r.summary = String(s).trim(); done++; } });
    } catch (e) {
      console.warn(`summary batch ${i / GEMINI_BATCH} failed: ${e.message}`);
    }
  }
  console.log(`· AI summaries: ${done}/${targets.length} emails summarized`);
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
      // format=full so we get body parts for the Gemini summarizer (still
      // includes all headers). Falls back gracefully if the key is absent —
      // the body is just used for summaries, never rendered directly.
      full = await gmail(token, `/threads/${t.id}?format=full`);
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
      // _body is a transient field for the summarizer — stripped before write.
      _body: extractBody(latest.payload),
    };
    buckets[bucket].push(row);
  }

  const order = { gmail: 0, gmailFollowUp: 1, waitingOn: 2, forgotten: 3, inboxOther: 4 };
  const allUnread = [].concat(...Object.values(buckets))
    .sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || '') || order[a.bucket] - order[b.bucket]);

  // AI summaries (best-effort). allUnread holds the same row references as the
  // buckets, so summarizing once fills row.summary everywhere.
  try { await addSummaries(allUnread); } catch (e) { console.warn('summaries skipped: ' + e.message); }
  // Drop the transient body field so it never lands in the published data.
  allUnread.forEach(r => { delete r._body; });

  // Merge into existing data.json (preserve HubSpot summary blocks; refresh them if token present).
  const dataPath = path.join(ROOT, 'data.json');
  let data = {};
  try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { /* fresh */ }

  Object.assign(data, buckets, { allUnread });
  data.refreshedAt = nowIso();
  data.meta = {
    refreshedAt: nowIso(), generatedAt: nowIso(),
    source: 'GitHub Actions — Gmail API (in:inbox is:unread) v0.5.0 routing tree + HubSpot counters',
    rule_version: 'v0.5.0-actions',
    note: 'Script-classified; one-line AI summaries via Gemini when GEMINI_API_KEY is set (else snippet fallback); newsletter senders heuristically routed to Other.',
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
