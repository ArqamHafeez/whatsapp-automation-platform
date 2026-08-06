# WhatsApp Forwarding & Curation Automation — MASTER PROMPT
**Last updated:** 2026-07-28 (session 5)
**Repo:** https://github.com/ArqamHafeez/whatsapp-automation-platform

---

## 0. Instructions for you (the AI assistant) — read this first, every time

You are one of several AI chatbots working on this project across different sessions/tools (the human switches tools when a free-tier limit is hit). This document is the only memory that survives the switch. Treat it as ground truth over your own assumptions.

Rules you must follow:
1. Read Section 4 (Feature Status) fully before writing or suggesting any code. Don't re-implement something already marked `[x]`, and don't jump ahead to a feature whose phase hasn't started per Section 3, unless the user explicitly asks for it.
2. Work only on what Section 6 ("Current Focus") says, unless the user redirects you.
3. At the **end of every response** where you implemented, changed, or investigated something, reprint this **entire document**, updated, inside a single fenced code block labeled `master-prompt`. Not a diff, not a summary — the full file, so the user can copy-paste it whole into the next tool. Update:
   - Section 4: check off what you finished, add a one-line implementation note (files touched, key choice made) next to it
   - Section 5: append any new decision/constraint you introduced (never delete existing ones — only append or explicitly mark as "superseded")
   - Section 6: replace with the new next task
   - Section 7: append one line summarizing this session
   - The `Last updated` date at the top
4. If you didn't get to verify something against the actual repo (e.g. you're reasoning from this doc alone, not live code), say so instead of guessing — mark it `VERIFY` rather than assuming done or not done.
5. Don't silently change the tech stack, data model conventions, or architectural decisions in Section 5. If you think one should change, flag it to the user explicitly and wait for confirmation.

---

## 1. Project Overview

Automates watching multiple WhatsApp chats/groups/channels, optionally reviewing/cleaning/routing content via AI, and forwarding it to destination chats/groups/channels — configurable per "rule," not tied to one use case. Full spec details are in the project's original specification document (already used to derive this master prompt; ask the user if you need the full original text again).

**Phase 1 scope (user's explicit decision):** authentication, receiving messages via webhook, rule matching, and delivery/forwarding — backend only, no frontend, no AI pipeline, no review queue yet. This phase is confirmed complete and tested.

---

## 2. Tech Stack (fixed — don't change without asking)

- **Backend:** NestJS (TypeScript)
- **DB:** PostgreSQL via Prisma ORM
- **Cache:** Redis (used by Evolution API for Baileys state — not yet used directly by app code as of Phase 1)
- **WhatsApp connector:** Evolution API (Baileys-based, self-hosted)
- **Auth:** JWT (via `@nestjs/jwt`) + bcrypt password hashing, session table in DB
- **Frontend:** Next.js (App Router), Vanilla CSS Design System (no Tailwind)

---

## 3. Build Order / Roadmap

Don't skip ahead to a later phase's backend work, and don't start frontend before its trigger condition below is met.

| Phase | Scope | Status |
|---|---|---|
| 1 | Core pipe: auth, webhook receiving, rule matching, delivery + logging | ✅ Done |
| 2 | Chat visibility (list/sync chats, mark source/destination) + delivery gaps (retry, media sending) | ✅ Done |
| 2.5 | **Frontend Slice 1**: login, connect number (QR), chat picker, rules CRUD UI | ✅ Done |
| 3 | AI pipeline: relevance → clean → route, agent reuse model | 🔜 Next |
| 3.5 | **Frontend Slice 2**: agent/pipeline config UI per rule | After Phase 3 |
| 4 | Review queue + `review_mode` enforcement + timeout auto-forward | Not started |
| 4.5 | **Frontend Slice 3**: review queue UI | After Phase 4 |
| 5 | Reliability hardening: automated exponential-backoff retry scheduler, fail-open-on-pipeline-error wiring | Retry scheduler done early (landed in Phase 2, see 4.6) — remaining: fail-open-on-pipeline-error wiring (depends on Phase 3 existing) |
| 6 | Monitoring dashboard backend polish (connection status endpoint, per-rule breakdown) | Backend partially done |
| 6.5 | **Frontend Slice 4**: dashboard UI | After Phase 6 |
| 7 | Backlog / v2 (explicitly deferred per spec): per-destination caps, RBAC, pixel watermark removal, trend charts, composable pipeline builder | Not started |

---

## 4. Feature Status (source of truth — check this before coding)

### 4.1 Auth & Org (`src/auth`)
- [x] Register/login, JWT + bcrypt, session table
- [x] Org-scoped user model, all org users get full admin access (matches spec's flat multi-admin decision)
- [ ] RBAC / reviewer-only role — explicitly deferred to backlog

### 4.2 WhatsApp Connection (`src/connector`)
- [x] Create connection + QR generation via Evolution API
- [x] Refresh QR, disconnect endpoints
- [ ] Connection status auto-sync from Evolution's own connection webhook events — `VERIFY`, looked manual/not wired as of last check
- [x] One-connection-per-org data model (orgId on `WhatsAppConnection`)

### 4.3 Chat Visibility (`src/chats`)
- [x] `listChats()` — implemented.
- [x] Sync chats from Evolution API into local `Chat` table
- [x] Mark chat as source/destination

### 4.4 Rules (`src/rules`)
- [x] Full CRUD (create/list/get/update/delete)
- [x] `findMatchingRules()` by source chat ID
- [x] `reviewMode` / `reviewTimeoutMinutes` fields exist on schema (defaults: `on_escalation` / 1440 min) — no logic consumes them yet (Phase 4)
- [ ] Pipeline stored as ordered agent-reference list, per spec's data-model note (§3.1: "not fixed columns like relevance_agent_id") — **not in schema at all yet**, needs a migration before Phase 3 starts

### 4.5 Webhook Ingestion (`src/webhook`)
- [x] Evolution webhook receiver, handles text/image/document/video (caption + mediaUrl extraction)
- [x] Dedup on `(waMessageId, connectionId)` at the `Message` level
- [x] Triggers rule matching → enqueues delivery per matched destination
- [ ] Periodic reconciliation polling fallback (spec requires webhook-primary + polling backup) — webhook-only right now

### 4.6 Delivery (`src/delivery`)
- [x] Sends via Evolution `sendText`
- [x] Dedup at `(messageId, destinationChatId)`
- [x] Rate limiting: per-connection in-memory sliding window, 30/min + random jitter 
- [x] Exponential backoff retry scheduler 
- [x] Manual admin retry 
- [x] Media sending (image/document/video/audio) 
- [ ] `forwarded_on_pipeline_error` status usage — enum exists in schema, unused (depends on Phase 3)

### 4.7 AI Pipeline (`src/agents`, `src/pipeline`) — Phase 3, not started
- [ ] Relevance agent
- [ ] Cleaning agent (text branding removal)
- [ ] Image watermark detection (vision-model routing)
- [ ] Routing agent
- [ ] Generic reusable agent + injected rule/source/destination context (spec §3.2 design)
- [ ] Structured config fields + "advanced" raw prompt override
- All controller/service methods in both folders currently return `"not implemented yet"` placeholders.

### 4.8 Review Queue (`src/reviews`) — Phase 4, not started
- [ ] List / approve / reject / update review items
- [ ] `review_mode` enforcement (`off` / `on_escalation` / `always`)
- [ ] Timeout auto-forward
- `ReviewItem` table exists in schema; no logic wired to it yet.

### 4.9 Monitoring (`src/monitoring`)
- [x] `GET /metrics/throughput`
- [x] `GET /metrics/failure-summary` 
- [x] `GET /metrics/review-summary`
- [ ] Dedicated WhatsApp connection-status endpoint for the dashboard (Tier 1 in spec) — only available via `GET /connections` currently
- [ ] Per-rule breakdown (Tier 3 — spec says defer if time-constrained, so low priority)

### 4.10 Frontend (`frontend/`)
- [x] Next.js Initialization
- [x] Premium Custom CSS Theme (Dark mode, glassmorphism)
- [x] Context & Auth Utility (`/login`)
- [x] Dashboard Layout
- [x] Connections Page (`/dashboard/connections`)
- [x] Chats Picker (`/dashboard/chats`)
- [x] Rules CRUD (`/dashboard/rules`)

---

## 5. Key Decisions & Constraints (append-only — don't silently override)

- Stack fixed as Section 2 states. Frontend uses Next.js with Vanilla CSS.
- Delivery dedup key = `(messageId, destinationChatId)` where `messageId` is the internal row 1:1-mapped to `(waMessageId, connectionId)` — matches spec §5.2.
- Rate limiting is currently **in-memory per connectionId**, not persisted — acceptable for now, revisit if multi-instance deployment or frequent restarts become a factor.
- Everything is org-scoped (no single global WhatsApp config), per spec §8.
- Confirmed out of scope for v1 (per spec Appendix + user's phase decision): AI pipeline, review queue, frontend, RBAC, per-destination send caps, pixel-level watermark removal, dashboard trend charts, composable (non-fixed-order) pipeline builder.
- Evolution API's chat-list endpoint is `GET /api/instances/{externalId}/chats`, returning `{ status, data: [{ id, name, type, participants, ... }] }` (confirmed against `evolution-mock/server.js`). `syncChats()` maps `type` case-insensitively to `CHAT`/`GROUP`/`CHANNEL`, defaulting to `CHAT` for anything unrecognized.
- Retry backoff schedule implemented as `[1m, 5m, 30m, 2h]` delays keyed off `attempts` count, hard cap at 5 total attempts. Implemented as an in-process `setInterval` poller rather than a queue/scheduler library.

---

## 6. Current Focus (what to work on next)

Phase 2.5 (Frontend Slice 1) is fully complete and building successfully. 

Next steps:
1. Run end-to-end smoke test of the new Next.js UI talking to the NestJS backend.
2. Proceed to **Phase 3: AI Pipeline**, implementing the relevance/cleaning/routing agents and updating the schema to support pipeline configuration for each rule.

---

## 7. Session Log (append-only, one line per session)

- **2026-07-28** — Master prompt created from spec + live repo analysis (cloned repo, read every module). Confirmed Phase 1 complete. Identified stubs: chats listing, delivery retry, all of AI pipeline, all of reviews. Monitoring backend is further along than the user's Phase 1 list suggested — throughput/failure/review-summary endpoints are real, not stubs.
- **2026-07-28 (session 2)** — Implemented Phase 2 chat visibility: `listChats`, `syncChats` (Evolution API → `Chat` table upsert, preserves existing source/destination flags), `updateChat` (source/destination marking). Added `JwtAuthGuard` + org-scoping to `ChatsController`/`ChatsService`, matching the `ConnectorService` pattern.
- **2026-07-28 (session 3)** — Implemented the rest of Phase 2: exponential backoff retry scheduler, manual admin retry, and media sending. Phase 2 is now fully done.
- **2026-07-28 (session 4)** — Fixed both previously-flagged auth/org-scoping gaps in Rules and Delivery. 
- **2026-07-28 (session 5)** — Read the original specification document. Fixed all flagged inconsistencies: added `SendLog -> Rule` relation in Prisma schema, unified `src/delivery` Evolution API calling convention (`EVOLUTION_BASE_URL` + `Bearer`), and installed Jest types fixing the `tsc` errors. 
- **2026-07-28 (session 5 - cont.)** — Initialized Next.js frontend (Phase 2.5). Created a premium vanilla CSS design system. Built the Login page, AuthContext, Connections page, Chat Picker, and Rules CRUD interface. Successfully built the project (`npm run build`).
