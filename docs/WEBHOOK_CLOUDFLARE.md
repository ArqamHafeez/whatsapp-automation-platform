# Webhooks: WAHA + Cloudflare + Nest

WAHA delivers inbound WhatsApp events to **your Nest backend**, not to the Next.js UI.

## Architecture

```text
WhatsApp → WAHA (e.g. :8081 on VPS or WSL)
              POST https://your-tunnel.example.com/webhook/waha
                    → Cloudflare Tunnel (or proxied DNS)
                    → NestJS :3000
                    → Message row + rule match + forward send
```

## 1. Nest environment

In the **backend** `.env` (repo root):

```env
WEBHOOK_PUBLIC_URL=https://your-public-host.example.com
WAHA_API_URL=http://127.0.0.1:8081
WAHA_API_KEY=your-key
```

- `WEBHOOK_PUBLIC_URL` must be the **public base URL** that reaches Nest (no trailing slash).
- The app registers `{WEBHOOK_PUBLIC_URL}/webhook/waha` on WAHA session create.

## 2. Cloudflare Tunnel (typical dev / small deploy)

Run `cloudflared` so **port 3000** (Nest) is published, not port 3001 (Next):

```yaml
# example config.yml
ingress:
  - hostname: api-autoforward.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Set:

```env
WEBHOOK_PUBLIC_URL=https://api-autoforward.example.com
```

**Checks:**

- Do **not** put Cloudflare Access in front of `/webhook/waha` unless WAHA is allowed through (service token / bypass rule).
- WAF rate limits can block WAHA; allow POST from your WAHA server IP if needed.

## 3. Register webhook on WAHA

### New connections

If `WEBHOOK_PUBLIC_URL` is set when you click **Connect Number**, WAHA session create includes the webhook block.

### Existing sessions

1. Set `WEBHOOK_PUBLIC_URL` and restart Nest.
2. In the dashboard: **Connections** → connected instance → **Register webhook**.

Or API (JWT):

```http
POST /connections/{connectionId}/register-webhook
Authorization: Bearer <token>
```

## 4. Verify

1. Restart Nest after env changes.
2. Register webhook for the connected session.
3. Send a test message to a **source** chat configured on an active rule (same WhatsApp connection).
4. Nest logs should show:
   - `WAHA webhook received`
   - `Message stored`
   - `rulesMatched=1` (or more)
5. Check **Delivery Log** in the UI for `sent` / `failed` rows.

## 5. Manual webhook test

```bash
curl -sS -X POST "https://your-public-host/webhook/waha" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message",
    "session": "default",
    "payload": {
      "id": "test_msg_1",
      "from": "923088830778@c.us",
      "fromMe": false,
      "body": "Hello from curl",
      "hasMedia": false
    }
  }'
```

Expected: `{ "received": true, "messageId": "...", ... }` if session `default` exists in DB.
