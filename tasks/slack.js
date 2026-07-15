window.TASK_DATA__slack = {
  "taskKey": "slack",
  "taskTitle": "Slack — Forgotten Replies",
  "description": "DMs + @-mentions across every channel Shelvi is a member of where the last message is NOT from her and is >24h old. High-precision feed — excludes threads where Shelvi has replied on any topic within the DM conversation. Bot/notification senders (HubSpot Breeze, Google Calendar) excluded.",
  "flaggedCriteria": "Slack messages · to:<@U063NRZ97A4> OR @-mention · last sender ≠ Shelvi · latestAt older than 24h · channel Shelvi is a member of · sender is not a bot. Excluded: any thread where Shelvi has posted in the last 24h on any topic.",
  "schedule": "Every 30 min · 07:00-19:00 Sydney",
  "slackUserId": "U063NRZ97A4",
  "meta": {
    "refreshedAt": "2026-04-22T08:00:00+10:00",
    "generatedAt": "2026-04-22T08:00:00+10:00",
    "source": "refresh-slack (Slack MCP — live pull)"
  },
  "summary": "2 Slack threads awaiting reply",
  "rows": [
    {
      "id": "slack-gdm-alex-escalation",
      "kind": "dm",
      "channel": "G-TNGO-SHELVI-ALEX-BECKY-PAUL-EMELIE",
      "channelLabel": "Group DM · Tyler Ngo, Alex DeRenzis, Becky Ledbetter, Paul Sajor, Emelie Cardem",
      "from": "Alex DeRenzis",
      "title": "Client escalation — unresolved, customer reached out again frustrated",
      "snippet": "Hi team - this is still left unresolved and the client has reached out again frustrated. Can we please ensure this gets actioned ASAP. Alex followed up: \"Hi Shelvi. I will forward you the email chain.\" — no reply from Shelvi yet.",
      "latestAt": "2026-04-20T19:00:00+10:00",
      "priority": "asap",
      "url": null
    },
    {
      "id": "slack-gdm-becky-kickoff",
      "kind": "dm",
      "channel": "G-SHELVI-COURTNEY-BECKY",
      "channelLabel": "Group DM · Courtney Butler, Becky Ledbetter",
      "from": "Becky Ledbetter",
      "title": "How did the kick off call go?",
      "snippet": "Becky following up on the CA/AU rectifications kick-off call. Shelvi hasn't replied in this group DM.",
      "latestAt": "2026-04-20T22:00:00+10:00",
      "priority": "today",
      "url": null
    }
  ]
};
