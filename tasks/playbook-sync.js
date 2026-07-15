window.TASK_DATA__playbook_sync = {
  "taskKey": "playbook-sync",
  "taskTitle": "Playbook Sync",
  "description": "Watches the AUS Operations workspace folder for new meeting notes, SOPs, Loom transcripts, or any document that adds rules, workflow updates, or next-steps. Detects what's changed, proposes a diff against the AU Operations Playbook in Notion, and writes only after Shelvi confirms the diff.",
  "flaggedCriteria": "Files added to /AUS Operations or /uploads in the last 24h matching meeting/SOP heuristics",
  "slashCommand": "/aus-operations:playbook-sync",
  "schedule": "Watcher · checks folder every 30 min",
  "lastRunAt": "2026-04-19T11:34:33Z",
  "summary": "No new files in the last 24h — playbook is in sync",
  "columns": [
    { "key": "customer",    "label": "Source file"   },
    { "key": "detectedAt",  "label": "Detected"      },
    { "key": "kind",        "label": "Kind"          },
    { "key": "targetPage",  "label": "Target page"   },
    { "key": "nextStep",    "label": "Next step"     }
  ],
  "rows": []
};
