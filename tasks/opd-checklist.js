window.TASK_DATA__opd_checklist = {
  "meta": {
    "refreshedAt": "2026-07-15T08:53:00+00:00",
    "generatedAt": "2026-07-15T08:53:00+00:00",
    "source": "HubSpot AU Global Operations pipeline (749963562) — Delivery Details / Pending SO stage (1105295899)",
    "rule": "Pass A: OPD <= today+30d (Sydney midnight, 2026-07-15) · Pass B: manual_link customer-claims-filled sweep, no OPD ceiling · Ella-owned deals excluded (v0.5.0)",
    "passACount": 0,
    "passBCount": 0,
    "notes": "Only ticket with OPD <= 30d (Hesta Sydney SO-001890, OPD 2026-08-14, 30d) dropped: associated deal owned by Ella Horner (Ella sends the Project Delivery Details form in her handover). Manual-link note + email-subject scans over all AU Pending SO tickets returned zero customer-claims-filled signals."
  },
  "taskKey": "opd-checklist",
  "taskTitle": "Pre-Delivery Checklist",
  "description": "AU tickets in Delivery Details / Pending Sales Order needing the pre-delivery checklist chase. No auto-email automation — Shelvi reviews every row and sends manually from HubSpot; every draft is a judgement call against ticket context. Rows with bucket='manual_link' route to the Manual link tab: the customer says the form is filled but it did not auto-link, so the action is paste-from-JotForm-admin into HubSpot (not email work), surfaced regardless of OPD distance.",
  "flaggedCriteria": "AU pipeline (749963562) · stage 1105295899 (Delivery Details/Pending Sales Order) · Pass A: OPD <= 30 days · Pass B (manual_link): all tickets in stage with customer-claims-filled signal",
  "preDeliveryFormUrl": "https://q92ix.share.hsforms.com/2oaCwEFnRQQK5sP54NkT30w",
  "summary": "0 AU tickets in Pending SO stage — 0 drafts ready for Shelvi to send, 0 flagged for manual chase, 0 flagged for manual JotForm paste",
  "hubspotPortalId": "44093193",
  "columns": [
    {
      "key": "customer",
      "label": "Customer"
    },
    {
      "key": "opd",
      "label": "OPD"
    },
    {
      "key": "owner",
      "label": "Owner"
    },
    {
      "key": "lastContact",
      "label": "Last activity"
    },
    {
      "key": "nextStep",
      "label": "Next step"
    }
  ],
  "rows": [],
  "buckets": {
    "standard": 0,
    "manual_link": 0
  }
};
