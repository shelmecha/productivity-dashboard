#!/usr/bin/env node
/**
 * Claude-free HubSpot feed refresher for the productivity dashboard.
 * Runs in GitHub Actions on a schedule (see .github/workflows/refresh-data.yml).
 *
 * Rewrites the deterministic HubSpot-driven feeds:
 *   tasks/aus-ops.json/.js            — AU New Ticket queue
 *   tasks/global-service-ca.json/.js  — CA service tickets owned by Shelvi
 *   tasks/opd-checklist.json/.js      — Pre-delivery checklist (OPD <= 30d, Ella-owned deals excluded)
 *   tasks/at-risk-opd.json/.js        — AMBER window (OPD 15-21d)
 *   tasks/opd-weekly-review.json/.js  — RED (0-14d) + OVERDUE
 *
 * NOT touched (need Gmail/Slack/LLM — refreshed by the Claude-side pipeline):
 *   data.json/.js, tasks/slack.*, tasks/radaro-post-install.*, tasks/*-prep.*
 *
 * Known simplifications vs the Claude skills (documented in each feed's meta):
 *   - repeat_push / delayed_pay / manual_link buckets need note-content scans -> always 0 here.
 *   - classifierNote / nextStep strings are templated, not judgement calls.
 *
 * Env: HUBSPOT_TOKEN (private app token; scopes: tickets read, deals read, owners read)
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.HUBSPOT_TOKEN;
if (!TOKEN) { console.error('HUBSPOT_TOKEN not set'); process.exit(1); }

const ROOT = path.join(__dirname, '..');
const PORTAL = '44093193';
const HS = 'https://api.hubapi.com';

// Pipelines / stages (labels fetched 2026-07-15)
const P_GLOBAL_OPS = '749963562';
const P_GLOBAL_SERVICE = '768255583';
const ST = {
  NEW_TICKET: '1105295898',
  DELIVERY_DETAILS: '1105295899',
  CUST_INFO_RECEIVED: '1091283321',
  APPROVED_SCHED: '1091283320',
  GS_SOLVED: '1123638123',
  GS_CANCELLED: '1314053420',
};
const GS_STAGE_LABELS = {
  '1123458862': 'Rectification Open', '1123458863': 'In Progress',
  '1314059152': 'Waiting for Customer', '1123638120': 'Waiting for Supplier Resolution',
  '1341411214': 'Waiting for Warehouse', '1123458864': 'Waiting for Parts',
  '1344955515': 'Waiting for Installer', '1123638122': 'Scheduled',
  '1340006069': 'Waiting for Customer Payment', '1123638123': 'Solved', '1314053420': 'Cancelled',
};
const OPS_STAGE_LABELS = {
  '1105295898': 'New Ticket', '1105295899': 'Delivery Details/Pending Sales Order',
  '1091283321': 'Customer Information Received', '1091283320': 'Approved for Scheduling',
  '1091283322': 'Holding Status', '1091257712': 'Install Prep',
  '1091257713': 'Installation Scheduled',
};
// Ordered board stages: New Ticket → Installation Scheduled (the AU Ops board).
const BOARD_STAGE_IDS = [
  '1105295898', '1105295899', '1091283321', '1091283320',
  '1091283322', '1091257712', '1091257713',
];
const GS_NEXT_STEP = {
  'Rectification Open': 'Assess issue and assign to appropriate technician or supplier.',
  'In Progress': 'Check on the assigned technician/supplier for progress.',
  'Waiting for Customer': 'Awaiting customer response — nudge if stale.',
  'Waiting for Supplier Resolution': 'Chase the supplier for their resolution ETA.',
  'Waiting for Warehouse': 'Confirm warehouse action / stock movement.',
  'Waiting for Parts': 'Chase supplier ETA on the part required to close out.',
  'Waiting for Installer': 'Confirm installer booking / availability.',
  'Scheduled': 'Booked — verify the appointment holds.',
  'Waiting for Customer Payment': 'Pending invoice / payment from customer — coordinate with finance.',
};
const OWNER_SHELVI = '1558931538';
const OWNER_ELLA = '69529968';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

/* Sydney "today" as a UTC-midnight Date, so day-window math matches the skills. */
function sydneyToday() {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
  return new Date(s + 'T00:00:00Z');
}
function daysFromToday(dateStr, today) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d)) return null;
  return Math.round((d - today) / 86400000);
}

async function hs(url, opts) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(HS + url, {
      ...opts,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts && opts.headers) },
    });
    if (r.status === 429 || r.status >= 500) {
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    if (!r.ok) throw new Error(`HubSpot ${r.status} on ${url}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  }
  throw new Error('HubSpot rate-limit retries exhausted on ' + url);
}

async function searchTickets(filters, properties, limit = 200) {
  const out = [];
  let after;
  do {
    const body = { filterGroups: [{ filters }], properties, limit: Math.min(limit, 200) };
    if (after) body.after = after;
    const j = await hs('/crm/v3/objects/tickets/search', { method: 'POST', body: JSON.stringify(body) });
    out.push(...(j.results || []));
    after = j.paging && j.paging.next && j.paging.next.after;
  } while (after && out.length < 1000);
  return out;
}

async function ownerMap() {
  const map = {};
  let after;
  do {
    const j = await hs('/crm/v3/owners?limit=500' + (after ? '&after=' + after : ''));
    (j.results || []).forEach(o => { map[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || String(o.id); });
    after = j.paging && j.paging.next && j.paging.next.after;
  } while (after);
  return map;
}

/* Deal owners associated with a ticket (for the Ella pre-delivery exclusion). */
async function ticketDealOwners(ticketId) {
  try {
    const a = await hs(`/crm/v4/objects/tickets/${ticketId}/associations/deals?limit=20`);
    const dealIds = (a.results || []).map(r => r.toObjectId);
    if (!dealIds.length) return [];
    const b = await hs('/crm/v3/objects/deals/batch/read', {
      method: 'POST',
      body: JSON.stringify({ inputs: dealIds.map(id => ({ id: String(id) })), properties: ['hubspot_owner_id'] }),
    });
    return (b.results || []).map(d => String(d.properties.hubspot_owner_id || ''));
  } catch (e) {
    console.warn('assoc lookup failed for ticket ' + ticketId + ': ' + e.message);
    return [];
  }
}

function ticketUrl(id) { return `https://app.hubspot.com/contacts/${PORTAL}/record/0-5/${id}`; }
function isAU(p) { return String(p.country_region || '').trim().toLowerCase() === 'australia'; }

function writeFeed(key, jsGlobal, payload) {
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(path.join(ROOT, 'tasks', key + '.json'), json + '\n');
  fs.writeFileSync(path.join(ROOT, 'tasks', key + '.js'), `window.${jsGlobal} = ${json};\n`);
  console.log(`✓ ${key} — ${(payload.rows || []).length} row(s)`);
}

const TICKET_PROPS = [
  'subject', 'hs_pipeline_stage', 'country_region', 'estimated_delivery_date',
  'confirmed_scheduled_date', 'order_customisation_notes', 'any_additional_notes_for_logistics_team',
  'hubspot_owner_id', 'createdate', 'hs_lastmodifieddate', 'approved_ticket_status',
];

(async () => {
  const today = sydneyToday();
  const todayStr = today.toISOString().slice(0, 10);
  const owners = await ownerMap();
  const ownerName = id => owners[String(id || '')] || null;
  const meta = extra => ({ refreshedAt: nowIso(), generatedAt: nowIso(), ...extra });

  /* ---- aus-ops: New Ticket stage, AU ---- */
  {
    const raw = await searchTickets(
      [
        { propertyName: 'hs_pipeline', operator: 'EQ', value: P_GLOBAL_OPS },
        { propertyName: 'hs_pipeline_stage', operator: 'EQ', value: ST.NEW_TICKET },
      ],
      TICKET_PROPS
    );
    const rows = raw.filter(t => isAU(t.properties)).map(t => {
      const p = t.properties;
      const custom = String(p.order_customisation_notes || '').trim();
      const ageDays = daysFromToday(p.createdate, today);
      return {
        id: String(t.id), ticketId: String(t.id),
        url: ticketUrl(t.id), hubspotLink: ticketUrl(t.id),
        customer: p.subject || '(no subject)',
        stage: 'New Ticket',
        opd: (p.estimated_delivery_date || '').slice(0, 10) || null,
        age: ageDays != null ? Math.abs(ageDays) + ' days' : null,
        owner: ownerName(p.hubspot_owner_id),
        lastContact: (p.hs_lastmodifieddate || '').slice(0, 10) || null,
        bucket: custom ? 'customisation' : 'standard',
        classifierNote: custom
          ? 'order_customisation_notes populated — customisation path (tag Courtney)'
          : 'no customisation notes — standard SO creation path',
        logisticsNote: String(p.any_additional_notes_for_logistics_team || '').trim(),
        nextStep: custom
          ? 'Customisation hold — Courtney owns end-to-end per Playbook v5'
          : 'Create SO in Inflow | move ticket to Delivery Details',
      };
    });
    writeFeed('aus-ops', 'TASK_DATA__aus_ops', {
      meta: meta({ source: `GitHub Actions HubSpot pull — AU Global Operations (${P_GLOBAL_OPS}) stage New Ticket, country=Australia` }),
      rows,
      buckets: {
        standard: rows.filter(r => r.bucket === 'standard').map(r => r.id),
        customisation: rows.filter(r => r.bucket === 'customisation').map(r => r.id),
      },
      summary: { newTickets: rows.length, customisationHolds: rows.filter(r => r.bucket === 'customisation').length, lastUpdated: nowIso() },
    });
  }

  /* ---- global-service-ca: open CA service tickets owned by Shelvi ---- */
  {
    const raw = await searchTickets(
      [
        { propertyName: 'hs_pipeline', operator: 'EQ', value: P_GLOBAL_SERVICE },
        { propertyName: 'hubspot_owner_id', operator: 'EQ', value: OWNER_SHELVI },
        { propertyName: 'hs_pipeline_stage', operator: 'NOT_IN', values: [ST.GS_SOLVED, ST.GS_CANCELLED] },
      ],
      TICKET_PROPS
    );
    const rows = raw.map(t => {
      const p = t.properties;
      const stage = GS_STAGE_LABELS[p.hs_pipeline_stage] || p.hs_pipeline_stage;
      const lastAct = p.hs_lastmodifieddate || p.createdate;
      return {
        id: 'gsca-' + t.id, ticketId: String(t.id),
        subject: p.subject || '(no subject)', customer: p.subject || '(no subject)',
        stageId: String(p.hs_pipeline_stage), stage,
        nextStep: GS_NEXT_STEP[stage] || 'Review ticket and decide next step.',
        description: null, booth: null, address: null,
        createdAt: p.createdate || null, lastActivityAt: lastAct || null,
        url: ticketUrl(t.id),
        lastActivityDays: lastAct ? Math.max(0, -daysFromToday(lastAct, today)) : null,
      };
    }).sort((a, b) => (b.lastActivityDays || 0) - (a.lastActivityDays || 0));
    writeFeed('global-service-ca', 'TASK_DATA__global_service_ca', {
      meta: meta({
        source: 'GitHub Actions HubSpot pull (refresh-hubspot.js)',
        pipeline: P_GLOBAL_SERVICE, ownerFilter: `Shelvi Alferez (${OWNER_SHELVI})`,
        totalRows: rows.length, note: 'Excludes Solved + Cancelled. Sorted stalest-first.',
      }),
      rows,
    });
  }

  /* ---- OPD windows: shared pull over pre-scheduling stages, AU, OPD set ---- */
  const preSched = await searchTickets(
    [
      { propertyName: 'hs_pipeline', operator: 'EQ', value: P_GLOBAL_OPS },
      { propertyName: 'hs_pipeline_stage', operator: 'IN', values: [ST.NEW_TICKET, ST.DELIVERY_DETAILS, ST.CUST_INFO_RECEIVED, ST.APPROVED_SCHED] },
      { propertyName: 'estimated_delivery_date', operator: 'HAS_PROPERTY' },
    ],
    TICKET_PROPS
  );
  const au = preSched.filter(t => isAU(t.properties) && !String(t.properties.confirmed_scheduled_date || '').trim());
  const opdRow = t => {
    const p = t.properties;
    const opd = (p.estimated_delivery_date || '').slice(0, 10);
    return {
      id: String(t.id), ticketId: String(t.id),
      customer: p.subject || '(no subject)',
      stage: OPS_STAGE_LABELS[p.hs_pipeline_stage] || p.hs_pipeline_stage,
      opd, opdDays: daysFromToday(opd, today),
      owner: ownerName(p.hubspot_owner_id),
      approvedTicketStatus: p.approved_ticket_status || null,
      url: ticketUrl(t.id),
      classification: 'NO_CONTEXT',
      nextStep: 'Review | OPD ' + (daysFromToday(opd, today) ?? '?') + 'd',
    };
  };

  /* at-risk-opd: AMBER 15-21d */
  {
    const rows = au.map(opdRow).filter(r => r.opdDays != null && r.opdDays >= 15 && r.opdDays <= 21)
      .sort((a, b) => a.opdDays - b.opdDays);
    writeFeed('at-risk-opd', 'TASK_DATA__at_risk_opd', {
      meta: meta({
        source: `GitHub Actions HubSpot pull — AMBER 15-21d OPD window vs Sydney ${todayStr}`,
        rule: 'AMBER opd_days in [15,21], pre-scheduled stages, confirmed_scheduled_date blank, flag-only',
        note: 'Deterministic pull — activity-history classification requires the Claude-side skill.',
      }),
      rows, buckets: { amber: rows.length },
    });
  }

  /* opd-weekly-review: RED 0-14d + OVERDUE */
  {
    const all = au.map(opdRow).filter(r => r.opdDays != null && r.opdDays <= 14).sort((a, b) => a.opdDays - b.opdDays);
    const red = all.filter(r => r.opdDays >= 0);
    const overdue = all.filter(r => r.opdDays < 0);
    writeFeed('opd-weekly-review', 'TASK_DATA__opd_weekly_review', {
      meta: meta({
        source: `GitHub Actions HubSpot pull — RED/OVERDUE vs Sydney ${todayStr}`,
        rule: 'RED opd_days in [0,14] + OVERDUE opd_days < 0. repeat_push/delayed_pay need note scans — always 0 here.',
        scope: '4 stages: New Ticket, Delivery Details/Pending SO, Customer Information Received, Approved for Scheduling',
      }),
      rows: all, red, overdue,
      buckets: { red: red.length, overdue: overdue.length, repeat_push: 0, delayed_pay: 0 },
    });
  }

  /* opd-checklist: Delivery Details stage, OPD <= 30d, Ella-owned deals excluded */
  {
    const candidates = au
      .filter(t => t.properties.hs_pipeline_stage === ST.DELIVERY_DETAILS)
      .map(opdRow)
      .filter(r => r.opdDays != null && r.opdDays <= 30);
    const rows = [];
    for (const r of candidates) {
      const dealOwners = await ticketDealOwners(r.ticketId);
      if (dealOwners.includes(OWNER_ELLA)) continue; // Ella sends the PDD form in her handover
      rows.push({ ...r, bucket: 'pending', draftReply: null });
    }
    writeFeed('opd-checklist', 'TASK_DATA__opd_checklist', {
      meta: meta({
        source: `GitHub Actions HubSpot pull — Delivery Details/Pending SO, OPD <= ${todayStr}+30d`,
        rule: 'Pass A only: OPD <= today+30d, Ella-owned deals excluded. manual_link (Pass B) needs note scans — Claude-side only.',
        passACount: rows.length, passBCount: 0,
      }),
      taskKey: 'opd-checklist', taskTitle: 'Pre-Delivery Checklist',
      rows,
    });
  }

  /* aus-ops-board: all AU tickets New Ticket → Installation Scheduled, for the
     status-filter board + OPD month calendar on the AU Operations page. */
  {
    const raw = await searchTickets(
      [
        { propertyName: 'hs_pipeline', operator: 'EQ', value: P_GLOBAL_OPS },
        { propertyName: 'hs_pipeline_stage', operator: 'IN', values: BOARD_STAGE_IDS },
      ],
      TICKET_PROPS
    );
    const rows = raw.filter(t => isAU(t.properties)).map(t => {
      const p = t.properties;
      const opd = (p.estimated_delivery_date || '').slice(0, 10) || null;
      return {
        id: String(t.id), ticketId: String(t.id),
        subject: p.subject || '(no subject)',
        customer: p.subject || '(no subject)',
        stageId: String(p.hs_pipeline_stage),
        stage: OPS_STAGE_LABELS[p.hs_pipeline_stage] || p.hs_pipeline_stage,
        opd,
        opdDays: daysFromToday(opd, today),
        owner: ownerName(p.hubspot_owner_id),
        url: ticketUrl(t.id),
      };
    });
    // Stable order: by pipeline stage, then soonest OPD first.
    const stageRank = id => BOARD_STAGE_IDS.indexOf(id);
    rows.sort((a, b) => stageRank(a.stageId) - stageRank(b.stageId)
      || (a.opd || '9999').localeCompare(b.opd || '9999'));
    writeFeed('aus-ops-board', 'TASK_DATA__aus_ops_board', {
      meta: meta({
        source: `GitHub Actions HubSpot pull — AU Global Operations (${P_GLOBAL_OPS}), stages New Ticket → Installation Scheduled`,
        stageOrder: BOARD_STAGE_IDS.map(id => OPS_STAGE_LABELS[id]),
      }),
      rows,
    });
  }

  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
