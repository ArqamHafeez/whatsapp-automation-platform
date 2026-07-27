# Mock Evolution API

A lightweight mock server for local development of the WhatsApp Connector module.

## Quick start

```bash
cd evolution-mock
npm install
npm start
```

Server runs on `http://localhost:3001` (configurable via `EVOLUTION_MOCK_PORT`).

## Environment variables

- `EVOLUTION_MOCK_PORT` — port (default 3001)
- `WEBHOOK_URL` — where to send incoming message events (default: `http://localhost:3000/webhook/incoming-message`)

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/instances/create` | Create a new connection |
| GET | `/api/instances` | List all connections |
| GET | `/api/instances/:id` | Get connection details |
| POST | `/api/instances/:id/qrcode` | Refresh QR code |
| POST | `/api/instances/:id/disconnect` | Disconnect |
| GET | `/api/instances/:id/chats` | List chats for connection |
| POST | `/api/instances/:id/send` | Send a message |
| POST | `/api/test/emit-message` | Emit a fake incoming message |

## Using with the backend connector

In your NestJS `.env`:

```
EVOLUTION_BASE_URL=http://localhost:3001
EVOLUTION_API_KEY=dev-key
```

## Testing incoming messages

To simulate an incoming message from a source chat:

```bash
curl -X POST http://localhost:3001/api/test/emit-message \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "instance-uuid",
    "chatId": "chat_1",
    "text": "Hello from a test message",
    "sender": "test-sender"
  }'
```

## Later: swap to real Evolution

When HR provides the production server:
1. Update `.env`:
   ```
   EVOLUTION_BASE_URL=https://hr-evolution-server.com
   EVOLUTION_API_KEY=<production-key>
   ```
2. No code changes needed — the connector is already abstracted to use environment variables.

## Notes

- This mock server uses in-memory storage. Data is lost on restart.
- For production, use the real Evolution API (self-hosted or managed).
- The mock intentionally does not handle authentication; use a dummy `EVOLUTION_API_KEY`.
