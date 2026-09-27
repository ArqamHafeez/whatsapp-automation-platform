# WhatsApp Automation Platform

NestJS backend + Next.js dashboard for receiving WhatsApp messages via **WAHA** (WhatsApp HTTP API), matching **forwarding rules**, and sending messages to destination chats (text and media).

## What is included

- **Backend (NestJS, port 3000)** — auth, WhatsApp connections, chat sync, rules, webhooks, delivery/forwarding
- **Frontend (Next.js, port 3001)** — login, connections (QR), chats, rules, delivery log
- **PostgreSQL** — users, connections, chats, rules, messages, send logs
- **WAHA (NOWEB engine)** — external WhatsApp session (channels supported)

For webhook setup with Cloudflare Tunnel, see [docs/WEBHOOK_CLOUDFLARE.md](docs/WEBHOOK_CLOUDFLARE.md).

---

## Prerequisites

Install on your machine:

| Tool | Version (tested) |
|------|------------------|
| **Node.js** | 20.x or later |
| **npm** | 10.x or later |
| **PostgreSQL** | 14+ |
| **WAHA (NOWEB)** | Running and reachable (e.g. `http://127.0.0.1:8081`) |

Optional for local testing without a real WhatsApp session:

- `evolution-mock/` — legacy mock (not used with WAHA)

---

## Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd whatsapp-automation-platform
```

---

## Step 2 — Backend environment

Copy the example env file and edit it:

```bash
cp .env.example .env
```

Edit **`.env`** at the repo root:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/whatsapp_platform?schema=public"

# Auth
JWT_SECRET="change-this-to-a-long-random-string"

# WAHA (WhatsApp HTTP API)
WAHA_API_URL="http://127.0.0.1:8081"
WAHA_API_KEY="your-waha-api-key"

# Public URL where Nest is reachable (required for WhatsApp webhooks)
WEBHOOK_PUBLIC_URL="https://your-public-backend-url.example.com"

# Optional: backend port (default 3000)
PORT=3000
```

**Important**

- Never commit `.env` — it contains secrets.
- `WEBHOOK_PUBLIC_URL` must point to **Nest on port 3000**, not the Next.js UI on 3001.
- WAHA webhooks are registered at: `{WEBHOOK_PUBLIC_URL}/webhook/waha`

---

## Step 3 — Create the database

Create a PostgreSQL database (example):

```bash
# Linux / macOS — adjust user/password as needed
createdb whatsapp_platform
```

Or with `psql`:

```sql
CREATE DATABASE whatsapp_platform;
```

---

## Step 4 — Install backend dependencies

From the **repo root**:

```bash
npm install
```

---

## Step 5 — Run database migrations

```bash
npm run db:generate
npm run db:migrate
```

If this is a **fresh empty database**, migrations should apply cleanly.

If you hit Prisma errors on an old database without migration history, so be careful if you want to run destructive commands like `prisma migrate reset`.

---

## Step 6 — Seed a demo admin user

```bash
npm run db:seed
```

Default login after seed:

| Field | Value |
|-------|--------|
| Email | `admin@demo.com` |
| Password | `admin123` |

Change this password in production.

---

## Step 7 — Start the backend

Development (auto-reload):

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

Backend runs at **http://localhost:3000**.

Quick check:

```bash
curl http://localhost:3000
```

---

## Step 8 — Frontend setup

Open a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```

Dashboard: **http://localhost:3001**

The Next.js app proxies API calls to Nest via `frontend/src/app/api/[...path]/route.ts`. By default it targets `http://127.0.0.1:3000`.

### Frontend env (optional)

Only needed if the default proxy target is wrong (e.g. WSL → Windows host):

```env
# frontend/.env.local  (do not commit)
BACKEND_URL=http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## Step 9 — Connect WhatsApp (Evolution)

1. Log in at http://localhost:3001/login (`admin@demo.com` / `admin123` after seed).
2. Go to **Connections** → create / connect a number.
3. Scan the QR code with WhatsApp.
4. When connected, click **Register webhook** (or create the connection with `WEBHOOK_PUBLIC_URL` already set in `.env`).
5. Go to **Chats** → **Sync from WhatsApp** so source/destination chats appear.

---

## Step 10 — Create a forwarding rule

1. Open **Rules** → **New rule**.
2. Select the **WhatsApp connection** (one instance per rule).
3. Check **source** chat(s) — where messages come from.
4. Check **destination** chat(s) — where messages are forwarded.
5. Save and ensure the rule is **active**.

When someone sends a message to a source chat, Nest should log:

```text
Evolution webhook received
Message stored … rulesMatched=1
[FORWARD SUCCESS]
```

Check **Delivery** in the dashboard for sent/failed rows.

---

## Step 11 — Webhooks in production / dev tunnel

Evolution must POST to your Nest server on the public internet.

1. Set `WEBHOOK_PUBLIC_URL` in `.env`.
2. Expose port **3000** (Cloudflare Tunnel, ngrok, VPS, etc.).
3. Restart Nest.
4. Register webhook on the connected instance.

Full guide: [docs/WEBHOOK_CLOUDFLARE.md](docs/WEBHOOK_CLOUDFLARE.md)

Test reachability:

```bash
curl -sS -X POST "https://your-public-host/webhook/evolution" \
  -H "Content-Type: application/json" \
  -d "{}"
```

You should get a JSON response (not connection refused).

---

## API testing (optional)

Use [api-test.http](api-test.http) in VS Code with the REST Client extension for manual webhook and delivery tests.

---

## Project structure

```text
whatsapp-automation-platform/
├── src/                    # NestJS backend
├── frontend/               # Next.js dashboard
├── prisma/                 # Schema + migrations + seed
├── docs/                   # Webhook / deployment notes
├── evolution-mock/         # Optional local Evolution mock
├── .env.example            # Env template (commit this)
├── package.json            # Backend dependencies
└── README.md               # This file
```

---

## What to push to GitHub

### Push these

| Path | Why |
|------|-----|
| `src/` | Backend source code |
| `frontend/src/`, `frontend/public/` | UI source and static assets |
| `frontend/package.json`, `frontend/package-lock.json` | Frontend dependencies |
| `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/eslint.config.mjs` | Frontend config |
| `frontend/AGENTS.md`, `frontend/CLAUDE.md` | Frontend agent notes |
| `prisma/schema.prisma` | Database schema |
| `prisma/migrations/` | All migration SQL files |
| `prisma/seed.ts` | Seed script |
| `docs/` | Documentation |
| `evolution-mock/` | Optional mock server for teammates |
| `.env.example` | Env template **without secrets** |
| `package.json`, `package-lock.json` | Backend dependencies |
| `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` | Backend TypeScript / Nest config |
| `jest.config.js` | Tests config |
| `api-test.http` | Manual API examples |
| `README.md` | Setup guide |

### Do **not** push these

| Path | Why |
|------|-----|
| `.env` | **Secrets** — DB password, JWT secret, Evolution API key |
| `frontend/.env`, `frontend/.env.local` | Local / secret frontend config |
| `node_modules/` | Reinstalled via `npm install` |
| `frontend/node_modules/` | Same |
| `dist/` | Backend build output |
| `frontend/.next/` | Frontend build cache |
| `frontend/out/` | Static export output |
| `*.log`, `npm-debug.log*` | Log files |
| `.DS_Store`, `Thumbs.db` | OS junk |
| `tmp-auth-check.js`, `test-auth-standalone.js` | Local scratch scripts |
| `package.json.backup` | Backup file |
| `master-prompt.md` | Internal prompt notes (unless team wants it) |
| `restart.sh` | Contains machine-specific paths (fix or omit) |
| `cloudflared` binary | Download separately per machine |
| Any file with passwords, API keys, or tokens | Security |

### Recommended before first push

1. Confirm `.env` is **not** staged: `git status` should not list `.env`.
2. If `.gitignore` is minimal, consider adding (locally or via a follow-up PR):

   ```gitignore
   node_modules
   dist
   .env
   .env.*
   !.env.example
   frontend/node_modules
   frontend/.next
   frontend/out
   *.log
   ```

3. Run `git status` and review every file before `git add`.

---

## Typical dev workflow (summary)

```bash
# Terminal 1 — backend
npm run start:dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Then: login → connect WhatsApp → sync chats → create rule → send test message.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Frontend cannot log in | Nest running on :3000; check browser network tab for `/api/auth/login` |
| No messages in Delivery | `WEBHOOK_PUBLIC_URL` set; webhook registered; tunnel hits **:3000** |
| `instance_not_found` in webhook | Evolution instance name matches DB `externalId` for that connection |
| `rulesMatched=0` | Rule active; correct connection; source chat synced and selected on rule |
| Media forward fails | Evolution `getBase64FromMediaMessage` reachable; see Nest logs for `[EvolutionMedia]` |
| Prisma migration errors | DB state vs migrations — coordinate with team before reset |

---


