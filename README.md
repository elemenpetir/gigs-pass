# Gigs Pass

Event ticketing platform built for flash-sale traffic: buyers join a fair virtual queue, get admitted in FIFO order, hold a time-limited slot, and pay. Organizers manage events and track revenue through a double-entry ledger. No overselling, no crashed checkouts, no bots jumping the line.

**The problem I solved:** high-demand ticket drops fail in predictable ways. Checkout floods crash servers, race conditions oversell limited stock, and bots crowd out real fans. Gigs Pass answers each with a specific mechanism: a Redis-backed virtual queue absorbs the flood, atomic stock operations make oversell impossible, TTL locks recycle abandoned slots, and per-user rate limits keep bots in line.

**Stack:** Node.js + Express, PostgreSQL (Supabase), Redis (Upstash), React (Vite) + Tailwind, Nginx, Docker, AWS EC2, GitHub Actions (CI/CD to GHCR + EC2).

---

## Role & Scope

Solo-built end to end: backend API and business logic, frontend buyer/organizer/admin flows, automated testing, CI/CD pipeline, cloud deployment, and load testing. Generalist scope, backend depth.

---

## Live Demo

- **App:** http://13-214-56-223.nip.io (demo instance on AWS free tier)
- Registration is open, so create a buyer account and try the queue flow yourself: pick an event, join the queue, watch your position update live, check out when admitted.
- Prefer running locally? See [Development Setup](#development-setup).

---

## Screenshots

<!-- TODO: add screenshots
- docs/screenshots/dashboard.png - organizer sales dashboard
- docs/screenshots/waiting-room.png - buyer waiting room with live position
- docs/screenshots/checkout.png - checkout with lock countdown
-->

---

## Key Engineering Decisions

Each decision below lists the alternatives I considered and why I chose what I did.

### 1. FIFO queue on Redis Sorted Set (score from atomic INCR, not timestamps)

Alternatives: database-backed queue table, timestamp scores, in-memory Node queue.
Why this: `INCR queue:seq` gives a gapless monotonic sequence, so `ZADD` score ordering is strict FIFO even under concurrent joins. `ZPOPMIN` admits from the front in O(log N). A database table would serialize every join on row locks; an in-memory queue would die with the process and break horizontal scaling. Idempotent re-join (`ZRANK` check before `ZADD`) means retries never duplicate a buyer.

### 2. Admission equals lock (TTL 300s, set at dequeue moment)

Alternatives: separate "granted" marker followed by a later lock step at checkout.
Why this: merging admission and locking into one atomic step (`SET lock EX 300 NX` + `DECR stock`, with `INCR` + `DEL` rollback on negative stock) closes a re-lock loophole and removes a whole round trip. One grant equals one shot: fail to pay or let the TTL expire, and you rejoin the line. Expired locks are cleaned up every dequeue tick and their stock returns to the pool within seconds.

### 3. Double-entry ledger, immutable entries

Alternatives: mutable balance columns on account rows, single transaction log.
Why this: every money movement writes balanced debit/credit rows that can never be updated or deleted (corrections are reversing entries). Balances are always derived from `SUM`, so money can never drift from history. Post-load audit on production data confirmed it: Rp500,000 debit equals Rp500,000 credit exactly, zero paid orders without entries, zero unbalanced orders. See [Post-Load Ledger Audit](#post-load-ledger-audit).

### 4. SSE over WebSocket for the waiting room

Alternatives: WebSocket, polling.
Why this: the waiting room is one-directional (server pushes position updates). SSE runs over plain HTTP, so it passes through Nginx and auth middleware with zero extra infrastructure, and reconnects natively. The frontend uses `@microsoft/fetch-event-source` instead of native `EventSource` because native EventSource cannot send Bearer headers, which the authenticated stream endpoint requires.

### 5. Auth-aware rate limiting (per-user join limit, per-IP global limit)

Alternatives: single global per-IP limiter, no limiter on joins.
Why this: a per-IP join limit punishes offices and campuses behind one NAT address. The join limiter keys on `user:id` (after authentication, NAT-proof) at 30/min, while the global and Nginx layers stay per-IP at 600/min for volumetric floods. Login counts only failures (`skipSuccessfulRequests`), so normal users never burn quota.

### 6. In-memory reference cache instead of more Redis or more queries

Alternatives: cache categories in Redis, or keep querying Postgres per request.
Why this: ticket categories are practically immutable reference data. A process-local `Map` with 60s TTL in `queueService.js` cuts Postgres queries per join from 2 to 1 with zero network hops and zero new infrastructure. The Redis usage ban (queue, locks, and stock counters only) stays intact.

### 7. GHCR image deploy via CI/CD (no builds on the server)

Alternatives: `git pull` + `docker compose build` on EC2.
Why this: CI builds backend and frontend images once, pushes to GHCR, and CD pulls them onto EC2 via SSM. The server holds no source code, no toolchain, and no build-time secrets. Every production container is traceable to a commit hash, which is how I verified the cache deploy (image digest match, no SSH guessing).

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Nginx     │────▶│  Backend    │
│  (React)    │     │  (Proxy)    │     │  (Express)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                    ┌─────────────┐             │
                    │  Upstash    │◀────────────┤
                    │   Redis     │             │
                    └─────────────┘             │
                                                │
                    ┌─────────────┐             │
                    │  Supabase   │◀────────────┘
                    │  PostgreSQL │
                    └─────────────┘
```

| Component    | Technology                 | Purpose                               |
| ------------ | -------------------------- | ------------------------------------- |
| API Gateway  | Nginx                      | Rate limiting, SSL termination, proxy |
| App Server   | Node.js + Express          | Business logic, REST API, SSE         |
| Queue Engine | Upstash Redis (Sorted Set) | Virtual queue, FIFO ordering          |
| Seat Locks   | Upstash Redis (TTL)        | 300s admission lock, no oversell      |
| Database     | Supabase PostgreSQL        | Persistent data, orders, ledger       |
| Frontend     | React + Vite + Tailwind    | Buyer/Organizer/Admin UI              |

---

## Measured Performance (k6, AWS t3.micro Free Tier)

I load-tested the deployed system instead of guessing. Environment: EC2 `t3.micro` (1 vCPU, 1 GB RAM), rate limits lifted for the test, Supabase + Upstash backends, test category quota 5000, k6 user pool 80, join ramp 50 to 300 RPS plus concurrent SSE ramp.

> Known limitation: scenario isolation failed, so both runs below executed join and SSE load simultaneously (up to 800 VUs). Treat the numbers as combined load. Thresholds: checks above 99 percent, p95 below 500ms, errors below 1 percent.

### Run 1, join-focused flag (5m34s)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,975 reqs at **80.76 req/s** | - | - |
| Successful joins | **23,567** / 2,332 failed (about 70.5 joins/s) | - | - |
| Checks success | 91.14% | above 99% | Fail |
| HTTP error rate | 8.81% | below 1% | Fail |
| p95 latency | 4.81s (avg 2.79s) | below 500ms | Fail |
| Dropped iterations | 13,100 (server too slow, k6 shed load) | - | - |

### Run 2, SSE-focused flag (5m31.9s)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,809 reqs at **80.78 req/s** | - | - |
| Successful joins | **23,474** / 2,264 failed (about 70.7 joins/s) | - | - |
| Checks success | 91.34% | above 99% | Fail |
| HTTP error rate | 8.60% | below 1% | Fail |
| p95 latency | 4.68s (avg 2.83s) | below 500ms | Fail |
| Dropped iterations | 13,261 | - | - |

### What the numbers mean

Thresholds were not met on either run, and that is itself the finding: the ceiling on a free-tier micro instance sits around 80 req/s combined load, with the database pool (max 20) and single vCPU as bottlenecks. What matters more than the ceiling:

- **No correctness failures at any load.** Zero oversells (stock depleted exactly to quota), FIFO held across 26k+ requests per run, expired locks returned stock to the pool.
- **Graceful degradation, not crashes.** Overload produced clean 500 JSON errors with the process alive for the full run, never hangs or corruption.
- **Conclusion: the ceiling is infrastructure, not design.** Same code on larger instances raises throughput; nothing in the results points at a logic bottleneck.

### Post-Load Ledger Audit

After 50k+ load-test requests against production data, I ran read-only integrity queries on Supabase:

- Global double-entry balance: Rp500,000 debit equals Rp500,000 credit exactly (5 payment splits: 5 debits, 10 credits)
- Orders created by load-test users: zero (load never touches checkout, as designed)
- Unbalanced orders: zero. Paid orders without ledger entries: zero.
- Stress category stock intact: quota 5000, zero paid, zero pending

---

## Test Coverage

- **265 unit tests**, all passing (services, models, middlewares, jobs, queue/lock/ledger logic with mocked DB)
- **Integration suite** against real PostgreSQL and Redis (migrations auto-applied to a separate test database)
- **k6 load tests** as above, with results committed to this file
- CI runs unit, integration, frontend lint, and production build on every push; images ship to GHCR only when all green

```bash
# Backend unit tests (mocked DB, fast)
cd backend && npm test

# Integration (needs DATABASE_URL_TEST, REDIS_URL)
cd backend && npm run test:integration

# All
cd backend && npm run test:all
```

---

## API Reference

Base URL: `/api`. All responses use a `{status, message, data}` envelope. Protected routes take a Bearer JWT.

### Auth (public + self)

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/auth/register` | No (10/min/IP) | buyer or organizer |
| POST | `/auth/login` | No (10/min/IP, failures only) | returns JWT |
| GET | `/auth/me` | Yes | session restore |

### Events (public + organizer + admin)

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/events` | No | published only, supports `?category=`, returns `min_price` |
| GET | `/events/:id` | No | event detail |
| GET | `/events/mine` | Organizer | own events |
| GET | `/events/:id/categories` | No | tiers for an event |
| GET | `/events/:id/orders` | Organizer | orders and fund status per event |
| POST | `/events` | Organizer | creates `draft` |
| PUT | `/events/:id` | Organizer (owner) | edit own event |
| POST | `/events/:id/image` | Organizer (owner) | poster upload |
| PUT | `/events/:id/publish` | Organizer (owner) | `draft` to `published` |
| PUT | `/events/:id/suspend` | Admin | investigate, pre-event only |
| PUT | `/events/:id/unsuspend` | Admin | back to `published` |
| PUT | `/events/:id/cancel` | Organizer/Admin | triggers refunds, pre-event only |
| POST | `/events/:id/categories` | Organizer | create tier |

### Ticket Categories

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| PUT | `/categories/:id` | Organizer (owner) | edit tier |

### Queue (buyer)

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/queue/:categoryId/join` | Yes (30/min/user) | idempotent; 409 carries resumable order |
| GET | `/queue/:categoryId/stream` | Yes (Bearer header, SSE) | `position` events, then `granted`, then close |

### Checkout and Orders (buyer)

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| POST | `/checkout/:categoryId/lock` | Buyer | verifies live reservation (403 without one) |
| GET | `/orders` | Buyer | order history |
| GET | `/orders/:id` | Buyer (owner) | static receipt |
| POST | `/orders` | Buyer | creates `awaiting_payment`; 409 resumes existing |
| POST | `/orders/:id/pay` | Buyer | mock payment `{success}`; success to `pending`, else `expired` |

### Admin and Analytics

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/admin/events` | Admin | all events |
| GET | `/admin/orders` | Admin | all orders |
| POST | `/admin/orders/:id/override` | Admin | `held` or `refunded` during holding period |
| GET | `/analytics/event/:id/overview` | Organizer (owner) | revenue, sales per tier, fund status |
| GET | `/analytics/platform/overview` | Admin | cross-event summary |

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Supabase account (PostgreSQL)
- Upstash account (Redis)

### Environment Variables

```bash
# backend/.env (local dev; production uses root .env, see docs/deployment.md)
DATABASE_URL=postgresql://...
DATABASE_SSL=true
REDIS_URL=redis://...
JWT_SECRET=...
CLOUDINARY_*=
RATE_LIMIT_JOIN_MAX=30
RATE_LIMIT_GLOBAL_MAX=600
```

### Run Locally

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Or Docker
docker compose up -d
```

### Stress Test (k6)

```bash
# Note: isolate scenarios in separate files for a pure single-scenario run.
# Test procedure (rate-limit bypass header was removed): lift limits via
# .env 99999 + no-limit nginx config, restore afterwards (docs/deployment.md).
k6 run --env TARGET_URL=http://localhost --env CATEGORY_ID=<category_id> tests/load/k6-script.js
```

---

## Deployment

- AWS EC2 free tier (`t3.micro`, 1 vCPU, 1 GB), Nginx host reverse proxy (port 80)
- Docker Compose: backend (5000), frontend (3000); Redis/Postgres external
- CI builds GHCR images on green pipelines; CD deploys to EC2 via SSM with health check
- Security Groups: 22 (SSH), 80/443 only. No app ports exposed
- Full runbook: `docs/deployment.md`

---

## Security

- `.env` never committed; secrets only in environment
- Passwords: bcrypt (10 rounds); JWT HS256, 7d expiry
- Rate limiting: Nginx volumetric + app auth-aware (per-user joins, failure-counted logins)
- No secrets in logs or responses; hardcoded test bypass removed

---

## What I Would Do Next

1. **Scale vertically first** (`t3.medium`, pool 20 to 50): cheapest 2 to 3x ceiling gain, matches measured bottlenecks.
2. **Scale horizontally** (ALB + N stateless nodes): needs Redis-backed rate limit store and SSE sticky sessions or pub/sub fan-out.
3. **Measure the cache impact**: isolated before/after run for the in-memory category cache.
4. **Harden what load testing exposed**: isolated single-scenario k6 files, 429 monitoring to tune limiter numbers from real traffic.
5. **Real payments**: replace the mock with a gateway sandbox (e.g. Xendit) behind the existing order state machine, which needs no changes.

---

## License

MIT
