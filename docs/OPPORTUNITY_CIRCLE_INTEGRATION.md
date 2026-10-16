# Opportunity Circle integration (read API)

Exposes **successful forwards to configured sink destinations** (e.g. Opportunity Circle channel) for the OC ingestor.

## 1. Migrate database

```bash
npm run db:migrate
```

## 2. Configure (dashboard UI)

Open **Dashboard → Opportunity Circle** (admin): enable integration, pick connection, select **sink** chats (your OC channel), map rule → category, **Generate API key**, copy into Opportunity Circle.

Or use the admin API below.

## 2b. Configure (admin JWT / API)

| Method | Path |
|--------|------|
| GET | `/admin/integrations/opportunity-circle` |
| PATCH | `/admin/integrations/opportunity-circle` |
| POST | `/admin/integrations/opportunity-circle/rotate-key` |
| GET | `/admin/integrations/opportunity-circle/preview?limit=5` |

**PATCH body example:**

```json
{
  "enabled": true,
  "connectionId": "<whatsapp-connection-uuid>",
  "sinkChatIds": ["<internal-chat-uuid-for-oc-channel>"],
  "primarySinkChatId": "<same-or-primary-sink>",
  "defaultCategory": "jobs",
  "categoryByRuleId": {
    "<rule-uuid>": "scholarships"
  }
}
```

Copy the **apiKey** from `rotate-key` into Opportunity Circle → Ingestion → WhatsApp settings. Disable **Use mock API** and set API URL to this Nest server (port 3000).

## 3. Public API (Bearer key)

```http
GET /integrations/opportunity-circle/health
GET /integrations/opportunity-circle/forwards?cursor=&limit=50
Authorization: Bearer <apiKey>
```

Only `SendLog` rows with `status = sent` to a **sink** destination are returned. One item per `messageId` (deduped).

**Pagination:** cursor-based DB batches (no fixed 500-row cap per request). **Rate limit:** `OC_INGEST_RATE_LIMIT_PER_MINUTE` (default 120) per organization on `health` and `forwards`. HTTP **429** when exceeded.

**Preview:** Dashboard → Opportunity Circle → **Load preview**, or admin `preview` endpoint (last successful sink forwards).

## 4. Opportunity Circle

Backend polls every `pollIntervalMinutes` or **Run ingest now** in admin UI.
