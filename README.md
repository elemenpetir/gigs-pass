# Gigs Pass

Event ticketing platform for high-demand ticket drops. Buyers join a virtual queue, get admitted in FIFO order, hold a timed reservation slot, and pay. Organizers manage events and track revenue through a double-entry ledger.

**Problem:** High-demand ticket drops fail in predictable ways: checkout spikes crash servers, race conditions oversell limited stock, and automated abuse is rate-limited per user and per IP. Gigs Pass addresses each with a specific mechanism: a Redis-backed virtual queue throttles entry, atomic stock operations prevent oversell, TTL locks release expired slots back to the pool, and per-user rate limits restrict bots.

---

## Tech Stack

**Backend**

- Node.js + Express.js
- PostgreSQL (Supabase)
- Redis (managed, rotasi Upstash / Redis Cloud)
- JSON Web Token (JWT)
- bcrypt
- Cloudinary (image upload)
- Jest + Supertest

**Frontend**

- React + Vite
- Tailwind CSS

**DevOps**

- Docker (multi-stage build + Nginx)
- GitHub Actions (CI/CD to GHCR + EC2)
- AWS EC2

**Testing**

- Jest + Supertest (unit + integration)
- Playwright (E2E)
- k6 (load testing)

---

## Role & Scope

Solo-built end to end: backend API and business logic, frontend buyer/organizer/admin flows, automated testing, CI/CD pipeline, cloud deployment, and load testing.

---

## Live Demo

- **App:** https://gigspass.xyz (demo instance on AWS free tier)
- Registration is open. Create a buyer account and try the queue flow: pick an event, join the queue, watch your position update live, check out when admitted.
- Prefer running locally? See [Development Setup](#development-setup).

---

## Screenshots

Live demo data on the AWS free-tier instance.

![Buyer waiting room with live queue position](docs/screenshots/waiting-room.png)
_Waiting room: live queue position pushed over SSE._

![Checkout with lock countdown](docs/screenshots/checkout.png)
_Checkout: 300s admission lock with countdown, then mock payment._

![Organizer sales dashboard](docs/screenshots/dashboard.png)
_Organizer dashboard: revenue, tickets sold, fund status, and per-tier charts._

---

## Key Engineering Decisions

### 1. FIFO queue on Redis Sorted Set (score from atomic INCR, not timestamps)

Alternatives: database-backed queue table, timestamp scores, in-memory Node queue.

`INCR queue:seq` gives a gapless monotonic sequence, so `ZADD` score ordering is strict FIFO even under concurrent joins. `ZPOPMIN` admits from the front in O(log N). A database table serializes every join on row locks; an in-memory queue dies with the process and breaks horizontal scaling. Idempotent re-join (`ZRANK` check before `ZADD`) ensures retries never duplicate a buyer.

### 2. Admission equals lock (TTL 300s, set at dequeue moment)

Alternatives: separate "granted" marker followed by a later lock step at checkout.

Merging admission and locking into one atomic step (`SET lock EX 300 NX` + `DECR stock`, with `INCR` + `DEL` rollback on negative stock) closes a re-lock loophole and removes a round trip. One grant is one attempt: if payment fails or the TTL expires, the buyer must rejoin the queue. Expired locks are cleaned up every dequeue tick and their stock returns to the pool within seconds.

### 3. Double-entry ledger, immutable entries

Alternatives: mutable balance columns on account rows, single transaction log.

Every money movement writes balanced debit/credit rows that can never be updated or deleted (corrections are reversing entries). Balances are always derived from `SUM`, so the balance is always verifiable against the full entry history. Post-load audit on production data confirmed it: Rp500,000 debit equals Rp500,000 credit exactly, zero paid orders without entries, zero unbalanced orders. See [Post-Load Ledger Audit](#post-load-ledger-audit).

### 4. SSE over WebSocket for the waiting room

Alternatives: WebSocket, polling.

The waiting room is one-directional (server pushes position updates). SSE runs over plain HTTP, passes through Nginx and auth middleware with zero extra infrastructure, and reconnects natively. The frontend uses `@microsoft/fetch-event-source` instead of native `EventSource` because native `EventSource` cannot send Bearer headers, which the authenticated stream endpoint requires.

### 5. Auth-aware rate limiting (per-user join limit, per-IP global limit)

Alternatives: single global per-IP limiter, no limiter on joins.

A per-IP join limit punishes offices and campuses behind one NAT address. The join limiter keys on `user:id` (after authentication, NAT-proof) at 30/min, while the global and Nginx layers stay per-IP at 600/min for volumetric floods. Login counts only failures (`skipSuccessfulRequests`), so normal users never burn quota.

### 6. In-memory reference cache instead of more Redis or more queries

Alternatives: cache categories in Redis, or keep querying Postgres per request.

Ticket categories are practically immutable reference data. A process-local `Map` with 60s TTL in `queueService.js` cuts Postgres queries per join from 2 to 1 with zero network hops and zero new infrastructure. The Redis usage constraint (queue, locks, and stock counters only) stays intact.

### 7. GHCR image deploy via CI/CD (no builds on the server)

Alternatives: `git pull` + `docker compose build` on EC2.

CI builds backend and frontend images once, pushes to GHCR, and CD pulls them onto EC2 via SSM. The server holds no source code, no toolchain, and no build-time secrets. Every production container is traceable to a commit hash.

---

## Architecture Overview

```
+-------------+     +-------------+     +-------------+
|   Client    |---->|   Nginx     |---->|  Backend    |
|  (React)    |     |  (Proxy)    |     |  (Express)  |
+-------------+     +-------------+     +------+------+
                                               |
                     +-------------+            |
                     |    Redis    |<-----------+
                     |  (managed)  |            |
                    +-------------+            |
                                               |
                    +-------------+            |
                    |  Supabase   |<-----------+
                    |  PostgreSQL |
                    +-------------+
```

| Component    | Technology                 | Purpose                               |
| ------------ | -------------------------- | ------------------------------------- |
| API Gateway  | Nginx                      | Rate limiting, SSL termination, proxy |
| App Server   | Node.js + Express          | Business logic, REST API, SSE         |
| Queue Engine | Redis (Sorted Set)             | Virtual queue, FIFO ordering          |
| Seat Locks   | Redis (TTL)                    | 300s admission lock, no oversell      |
| Database     | Supabase PostgreSQL        | Persistent data, orders, ledger       |
| Frontend     | React + Vite + Tailwind    | Buyer/Organizer/Admin UI              |

---

## Measured Performance (k6, AWS t3.micro Free Tier)

Environment: EC2 `t3.micro` (1 vCPU, 1 GB RAM), rate limits lifted for the test, Supabase + Upstash backends, test category quota 5000, k6 user pool 80, join ramp 50 to 300 RPS plus concurrent SSE ramp.

> Known limitation: scenario isolation failed during these runs, so both runs executed join and SSE load simultaneously (up to 800 VUs). Treat the numbers as combined load, not isolated per-scenario results. Thresholds: checks above 99%, p95 below 500ms, errors below 1%.

### Run 1: join-focused flag (5m34s)

| Metric             | Value                                     | Threshold   | Status |
| ------------------ | ----------------------------------------- | ----------- | ------ |
| HTTP throughput    | 26,975 reqs at **80.76 req/s**            | -           | -      |
| Successful joins   | **23,567** / 2,332 failed (~70.5 joins/s) | -           | -      |
| Checks success     | 91.14%                                    | above 99%   | Fail   |
| HTTP error rate    | 8.81%                                     | below 1%    | Fail   |
| p95 latency        | 4.81s (avg 2.79s)                         | below 500ms | Fail   |
| Dropped iterations | 13,100                                    | -           | -      |

### Run 2: SSE-focused flag (5m31.9s)

| Metric             | Value                                     | Threshold   | Status |
| ------------------ | ----------------------------------------- | ----------- | ------ |
| HTTP throughput    | 26,809 reqs at **80.78 req/s**            | -           | -      |
| Successful joins   | **23,474** / 2,264 failed (~70.7 joins/s) | -           | -      |
| Checks success     | 91.34%                                    | above 99%   | Fail   |
| HTTP error rate    | 8.60%                                     | below 1%    | Fail   |
| p95 latency        | 4.68s (avg 2.83s)                         | below 500ms | Fail   |
| Dropped iterations | 13,261                                    | -           | -      |

### Analysis

Thresholds were not met on either run. The ceiling on a free-tier micro instance sits around 80 req/s combined load, with the database pool (max 20) and single vCPU as the bottlenecks.

- **Zero correctness failures at any load.** Zero oversells (stock depleted exactly to quota), FIFO held across 26k+ requests per run, expired locks returned stock to the pool.
- **Graceful degradation.** Overload produced clean 500 JSON errors with the process alive for the full run, no hangs or data corruption.
- **Based on the results, the primary bottleneck appears to be CPU saturation on t3.micro (single vCPU), not queue or ledger logic.** The database pool (max 20) has sufficient headroom for the measured load (~80 req/s); the pool size is a deliberate configuration choice, not a platform constraint. Vertical scaling is the next step to verify this.
- **Rate-limit caveat:** Both runs came from a single egress IP with limits lifted. These error/latency numbers must not be reused for per-IP limiter tuning. App defaults are validated separately by synthetic tests.
- **Quota caveat (Sep 2026):** These runs burned through the Upstash free quota (500K commands/month), taking down prod queueing until the monthly reset. Prod Redis now rotates between Upstash and Redis Cloud free (see docs/DECISIONS.md #21); load tests must never target managed prod Redis (see `docs/deployment.md` §5a).

### Post-Load Ledger Audit

After 50k+ load-test requests against production data, read-only integrity queries were run on Supabase:

- Global double-entry balance: Rp500,000 debit equals Rp500,000 credit exactly (5 payment splits: 5 debits, 10 credits)
- Orders created by load-test users: zero (load never touches checkout, as designed)
- Unbalanced orders: zero. Paid orders without ledger entries: zero.
- Stress category stock intact: quota 5000, zero paid, zero pending

---

## Test Coverage

- **271 unit tests**, all passing (services, models, middlewares, jobs, queue/lock/ledger logic with mocked DB)
- **Integration suite** against real PostgreSQL and Redis (migrations auto-applied to a separate test database)
- **k6 load tests** as above, with results committed to this file
- **Playwright E2E (10 tests, manual workflow)** against live backend + real PostgreSQL/Redis (auth, buyer queue-checkout, organizer, admin override); trigger via Actions tab, E2E workflow, Run workflow
- CI runs unit, integration, frontend lint, and production build on every push; images ship to GHCR only when all green

```bash
# Backend unit tests (mocked DB, fast)
cd backend && npm test

# Integration (needs DATABASE_URL_TEST, REDIS_URL)
cd backend && npm run test:integration

# All
cd backend && npm run test:all

# E2E (needs local PostgreSQL + Redis, backend on :5000, then frontend preview)
cd frontend && npm run test:e2e
```

---

## API Reference

Base URL: `/api`. All responses use a `{status, message, data}` envelope. Protected routes take a Bearer JWT.

### Auth (public + self)

| Method | Path             | Auth                          | Notes              |
| ------ | ---------------- | ----------------------------- | ------------------ |
| POST   | `/auth/register` | No (10/min/IP)                | buyer or organizer |
| POST   | `/auth/login`    | No (10/min/IP, failures only) | returns JWT        |
| GET    | `/auth/me`       | Yes                           | session restore    |

### Events (public + organizer + admin)

| Method | Path                     | Auth              | Notes                                                      |
| ------ | ------------------------ | ----------------- | ---------------------------------------------------------- |
| GET    | `/events`                | No                | published only, supports `?category=`, returns `min_price` |
| GET    | `/events/:id`            | No                | event detail                                               |
| GET    | `/events/mine`           | Organizer         | own events                                                 |
| GET    | `/events/:id/categories` | No                | tiers for an event                                         |
| GET    | `/events/:id/orders`     | Organizer         | orders and fund status per event                           |
| POST   | `/events`                | Organizer         | creates `draft`                                            |
| PUT    | `/events/:id`            | Organizer (owner) | edit own event                                             |
| POST   | `/events/:id/image`      | Organizer (owner) | poster upload                                              |
| PUT    | `/events/:id/publish`    | Organizer (owner) | `draft` to `published`                                     |
| PUT    | `/events/:id/suspend`    | Admin             | investigate, pre-event only                                |
| PUT    | `/events/:id/unsuspend`  | Admin             | back to `published`                                        |
| PUT    | `/events/:id/cancel`     | Organizer/Admin   | triggers refunds, pre-event only                           |
| POST   | `/events/:id/categories` | Organizer         | create tier                                                |

### Ticket Categories

| Method | Path              | Auth              | Notes     |
| ------ | ----------------- | ----------------- | --------- |
| PUT    | `/categories/:id` | Organizer (owner) | edit tier |

### Queue (buyer)

| Method | Path                        | Auth                     | Notes                                         |
| ------ | --------------------------- | ------------------------ | --------------------------------------------- |
| POST   | `/queue/:categoryId/join`   | Yes (30/min/user)        | idempotent; 409 carries resumable order       |
| GET    | `/queue/:categoryId/stream` | Yes (Bearer header, SSE) | `position` events, then `granted`, then close |

### Checkout and Orders (buyer)

| Method | Path                         | Auth          | Notes                                                          |
| ------ | ---------------------------- | ------------- | -------------------------------------------------------------- |
| POST   | `/checkout/:categoryId/lock` | Buyer         | verifies live reservation (403 without one)                    |
| GET    | `/orders`                    | Buyer         | order history                                                  |
| GET    | `/orders/:id`                | Buyer (owner) | static receipt                                                 |
| POST   | `/orders`                    | Buyer         | creates `awaiting_payment`; 409 resumes existing               |
| POST   | `/orders/:id/pay`            | Buyer         | mock payment `{success}`; success to `pending`, else `expired` |

### Admin and Analytics

| Method | Path                            | Auth              | Notes                                      |
| ------ | ------------------------------- | ----------------- | ------------------------------------------ |
| GET    | `/admin/events`                 | Admin             | all events                                 |
| GET    | `/admin/orders`                 | Admin             | all orders                                 |
| POST   | `/admin/orders/:id/override`    | Admin             | `held` or `refunded` during holding period |
| GET    | `/reports/event/:id/overview`   | Organizer (owner) | revenue, sales per tier, fund status       |
| GET    | `/reports/platform/overview`    | Admin             | cross-event summary                        |

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Supabase account (PostgreSQL)
- Upstash / Redis Cloud free account 

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

# Or with Docker
docker compose up -d
```

### Stress Test (k6)

```bash
# Isolate scenarios in separate files for a clean single-scenario run.
# Rate-limit bypass header has been removed. To lift limits: set .env to 99999
# and swap the nginx config (see docs/deployment.md, section 5a). Restore afterwards.
k6 run --env TARGET_URL=http://localhost --env CATEGORY_ID=<category_id> tests/load/k6-script.js
```

---

## Deployment

- AWS EC2 free tier (`t3.micro`, 1 vCPU, 1 GB), Nginx host reverse proxy (port 80)
- Docker Compose: backend (5000), frontend (3000); Redis/Postgres external
- CI builds GHCR images on green pipelines; CD deploys to EC2 via SSM with health check
- Security Groups: 22 (SSH), 80/443 only. No app ports exposed.
- Full runbook: `docs/deployment.md`

---

## Security

- `.env` never committed; secrets only in environment
- Passwords: bcrypt (10 rounds); JWT HS256, 7d expiry
- Rate limiting: Nginx volumetric + app auth-aware (per-user joins, failure-counted logins)
- No secrets in logs or responses; hardcoded test bypass removed

---

## Future Work

1. **Scale vertically first** (`t3.medium`, pool 20 to 50): cheapest path to 2-3x ceiling gain, matches measured bottlenecks.
2. **Scale horizontally** (ALB + N stateless nodes): requires Redis-backed rate limit store and SSE sticky sessions or pub/sub fan-out.
3. **Improve load test harness**: isolated single-scenario k6 files as before/after benchmarks for the in-memory category cache; app rate-limit defaults (10/10/30/600) validated synthetically (`rateLimiter.defaults.test.js`), nginx/CGNAT tuning still needs real multi-IP traffic.
4. **Real payments**: replace the mock with a payment gateway sandbox (e.g. Xendit) behind the existing order state machine, which requires no architectural changes.
5. **Leave Queue** (`POST /queue/:categoryId/leave`): `ZREM` the buyer from the sorted set; if the buyer already holds a lock, the slot self-heals via TTL cleanup within 300s. Rejoin remains safe because queue sequence is monotonically increasing.
6. **SSE optimization**: replace the current per-connection 2s position polling with a server-push model. Currently each buyer in the waiting room queries their position every 2 seconds regardless of queue activity. The proposed approach: the dequeuer announces changes only when they occur via two methods: `applyAdmission` (popped buyers receive a direct `granted` event, remaining buyers get position decremented by batch size) and `applyLeave` (buyers behind the leaver get -1, buyers ahead are unchanged). Initial position is fetched once on connect; auto-reconnect serves as natural re-sync. Zero redundant Postgres and Redis queries at steady state.

---

## License

MIT
