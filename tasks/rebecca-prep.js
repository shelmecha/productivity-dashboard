window.TASK_DATA__rebecca_prep = {
  "taskKey": "rebecca-prep",
  "taskTitle": "1:1 Meeting — Rebecca",
  "description": "Pre-meeting prep for Shelvi's weekly 1:1. Auto-populated from last-7d HubSpot activity, current dashboard state, and recurring ops themes. Concerns and questions are editable and persist locally. Attendee is set via the meetingAttendee field.",
  "schedule": "Auto-refreshed Monday 07:00 Sydney + on-demand from page Refresh button",
  "meetingCadence": "weekly",
  "meetingAttendee": {
    "name": "Rebecca",
    "role": "COO"
  },
  "owner": "Shelvi Alferez — Global Quality Lead",
  "weekOf": "2026-07-06",
  "windowStart": "2026-07-06",
  "windowEnd": "2026-07-12",
  "meta": {
    "refreshedAt": "2026-07-15T19:25:00+10:00",
    "generatedAt": "2026-07-15T19:25:00+10:00",
    "source": "prep-rebecca-1-1 (HubSpot MCP + local feeds)"
  },
  "summary": "Week of Jul 6 — 0 RED OPDs moved, 0 AMBER flagged, 5 CA service tickets in flight, 0 pre-delivery checklists queued. 2 concerns surfaced.",
  "executiveSummary": [
    "OPD hygiene fully clean — zero RED, AMBER, or overdue AU tickets this window; nearest OPD sits 30 days out. 6 installs completed, 5 newly scheduled.",
    "CA service queue is down to 5 Shelvi-owned open tickets (5 closed this window) — the capacity crunch has eased, but the oldest (DD West) has waited on parts since March.",
    "Holding Status is now the biggest pool: 21 AU tickets parked, oldest since December — needs a triage pass to separate real holds from stale ones."
  ],
  "lastWeek": {
    "opd": {
      "redMoved": 0,
      "amberFlagged": 0,
      "overduePushed": 0,
      "holdingPending": 21,
      "notesPosted": 0,
      "pastOpdRemaining": 0,
      "commentary": "Zero RED, AMBER, or overdue this window — nearest AU OPD is 30d out (Aug 14). 21 tickets sit in Holding Status. Note count not scanned this run."
    },
    "tickets": {
      "newTicketsProcessed": 1,
      "customisationHolds": 0,
      "scheduledForInstall": 5,
      "installsCompleted": 6,
      "commentary": "1 ticket left New Ticket (C Capital), 5 entered Installation Scheduled, 6 installs completed. Zero customisation holds flagged."
    },
    "customerComms": {
      "preDeliveryChecklistsSent": 0,
      "paymentChasesResolved": 0,
      "paymentChasesOpen": 10,
      "clientUpdatesSent": 0,
      "commentary": "0 pre-delivery sends — queue empty (only ≤30d ticket is Ella-owned, excluded). 10 pre-scheduled AU tickets blank on approved_ticket_status, oldest Mar 17."
    },
    "globalServiceCA": {
      "newTicketsIn": 14,
      "ticketsClosed": 5,
      "openEndOfWeek": 5,
      "commentary": "14 new CA tickets in, 5 closed in window. 5 Shelvi-owned open end-of-week — oldest (DD West) waiting on parts since Mar 4."
    },
    "radaro": {
      "installReportsReceived": 0,
      "ticketsClosedOut": 0,
      "pendingCloseOut": 9,
      "driverFlags": 0,
      "commentary": "9 reports pending close-out, all landed Jul 14–15 (post-window), oldest 1 day — inside 48h SLA. In-window receipt count not scanned this run."
    }
  },
  "charts": {
    "pipelineByStage": [
      {
        "label": "New Ticket",
        "count": 1,
        "color": "#3b7cff"
      },
      {
        "label": "Delivery Details",
        "count": 0,
        "color": "#a78bfa"
      },
      {
        "label": "Pending Sales Order",
        "count": 9,
        "color": "#8b5cf6"
      },
      {
        "label": "Customer Info Received",
        "count": 5,
        "color": "#06b6d4"
      },
      {
        "label": "Approved for Scheduling",
        "count": 2,
        "color": "#10b981"
      },
      {
        "label": "Installation Scheduled",
        "count": 5,
        "color": "#f5a623"
      },
      {
        "label": "Holding Status",
        "count": 21,
        "color": "#ef4444"
      }
    ],
    "opdActionsLast4w": [
      {
        "week": "Jun 15",
        "red": 0,
        "amber": 0,
        "overdue": 0
      },
      {
        "week": "Jun 22",
        "red": 0,
        "amber": 0,
        "overdue": 0
      },
      {
        "week": "Jun 29",
        "red": 0,
        "amber": 0,
        "overdue": 0
      },
      {
        "week": "Jul 6",
        "red": 0,
        "amber": 0,
        "overdue": 0
      }
    ],
    "installCompletionTrend": [
      {
        "week": "Jun 15",
        "completed": 0
      },
      {
        "week": "Jun 22",
        "completed": 0
      },
      {
        "week": "Jun 29",
        "completed": 0
      },
      {
        "week": "Jul 6",
        "completed": 6
      }
    ],
    "queueHealth": [
      {
        "queue": "New Tickets",
        "count": 1,
        "sla": "24h",
        "oldestDays": 9
      },
      {
        "queue": "Pre-Delivery Checklist",
        "count": 0,
        "sla": "≤30d OPD",
        "oldestDays": 0
      },
      {
        "queue": "AMBER OPD",
        "count": 0,
        "sla": "15–21d",
        "oldestDays": 0
      },
      {
        "queue": "CA Service (Shelvi)",
        "count": 5,
        "sla": "5 biz d",
        "oldestDays": 133
      },
      {
        "queue": "Radaro PODs",
        "count": 9,
        "sla": "48h",
        "oldestDays": 1
      },
      {
        "queue": "Slack Forgotten",
        "count": 1,
        "sla": "24h",
        "oldestDays": 7
      }
    ]
  },
  "concerns": [
    {
      "id": "c-holding-stall",
      "severity": "med",
      "title": "21 AU tickets parked in Holding Status — oldest since December",
      "detail": "Holding Status is now the largest stage in the AU pipeline (21 of 47 open tickets). Oldest entries (Squadron Energy, Harris Real Estate, Cisco 2nd order) date back to Dec 2025 / Jan 2026. Risk: stale holds hide real revenue and distort pipeline reads. Suggested action: a joint triage pass to reconfirm each hold reason and release or cancel dead ones.",
      "evidence": [
        "tasks/rebecca-prep.json"
      ],
      "autoDetected": true
    },
    {
      "id": "c-payment-chase-aging",
      "severity": "high",
      "title": "10 pre-scheduled AU tickets blank on approved_ticket_status",
      "detail": "10 of 16 tickets across New Ticket / Pending SO / Customer Info Received have no approved_ticket_status set — oldest (WAGEC repeat order) created Mar 17. Payment-signal scan was not run this refresh, so some may simply be unapproved paperwork rather than unpaid. Risk: unpaid tickets drifting toward scheduling. Suggested action: reconcile the 10 with Teya before next Monday's OPD sweep.",
      "evidence": [
        "tasks/rebecca-prep.json"
      ],
      "autoDetected": true
    }
  ],
  "questions": [
    {
      "id": "q-ca-ownership",
      "topic": "Resourcing / ownership",
      "question": "CA service queue — is there a plan to bring on a second CA ops owner, or should I propose a triage cut-off (e.g., only warranty + escalations) and push the rest to a shared queue?",
      "context": "I'm at 20 open, net +3 this week. Willing to propose a triage rule if we want to hold the line without hiring.",
      "priority": "high",
      "seeded": true
    },
    {
      "id": "q-customisation-edge-cases",
      "topic": "Playbook v5 — customisation authority",
      "question": "v5 §6.4 gives me end-to-end customisation authority incl. refusal. Two holds this week were clean, but I hit one grey case where sales escalated. Do we want a documented escalation path (me → you) for disputed holds, or leave it case-by-case?",
      "context": "Mula-style line-item/SO mismatches — the reason we rewrote §6.4 in the first place.",
      "priority": "high",
      "seeded": true
    },
    {
      "id": "q-payment-chase-escalation",
      "topic": "Payment / Teya coordination",
      "question": "Current rule: tag Teya at 24h, re-tag at 48h. 3 AMBER tickets are now past 48h with no movement. Should I loop Teya in earlier at AMBER stage (preemptive), or hold the rule?",
      "context": "Preemptive = more noise for Teya, less chance of a RED next Monday. Current rule = cleaner signal but we risk the drop.",
      "priority": "med",
      "seeded": true
    },
    {
      "id": "q-post-install-comms",
      "topic": "Post-install client communication",
      "question": "v5 §11.1.1 — ops never emails customer post-install; Deal Owner handles it. One sales rep pushed back this week saying they're too thin to pick up the handoff. Do we reinforce the rule with sales leadership, or build a template pack to make it trivial for them?",
      "context": "Template pack is more scalable but it's not our lane.",
      "priority": "med",
      "seeded": true
    },
    {
      "id": "q-container-risk",
      "topic": "Supply chain / containers",
      "question": "Any visibility I should have on container delays this quarter? I'm tracking OPD hygiene downstream but I don't see upstream shipment risk until Tyler's sheet updates.",
      "context": "Would like to pre-flag impacted tickets before Monday OPD review, not react after the OPD slips.",
      "priority": "med",
      "seeded": true
    }
  ],
  "rebeccaActionItems": [
    {
      "id": "ra-prev-1",
      "fromMeetingDate": "2026-04-17",
      "item": "Confirm Canada ops hiring timeline",
      "status": "pending",
      "owner": "Rebecca"
    },
    {
      "id": "ra-prev-2",
      "fromMeetingDate": "2026-04-17",
      "item": "Loop Paul in on customisation refusals dispute process",
      "status": "pending",
      "owner": "Rebecca"
    }
  ],
  "theirActionItems": [
    {
      "id": "ra-prev-1",
      "fromMeetingDate": "2026-04-17",
      "item": "Confirm Canada ops hiring timeline",
      "status": "pending",
      "owner": "Rebecca"
    },
    {
      "id": "ra-prev-2",
      "fromMeetingDate": "2026-04-17",
      "item": "Loop Paul in on customisation refusals dispute process",
      "status": "pending",
      "owner": "Rebecca"
    }
  ],
  "myCommitments": [
    {
      "id": "mc-prev-1",
      "fromMeetingDate": "2026-04-17",
      "item": "Roll out v5 §6.4 end-to-end customisation workflow — full week",
      "status": "done"
    },
    {
      "id": "mc-prev-2",
      "fromMeetingDate": "2026-04-17",
      "item": "Clear AMBER backlog by Friday",
      "status": "in_progress"
    },
    {
      "id": "mc-prev-3",
      "fromMeetingDate": "2026-04-17",
      "item": "Update Notion — refund/cancel SOP draft v2",
      "status": "pending"
    }
  ]
};
