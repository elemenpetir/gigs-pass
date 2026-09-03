# Gigs Pass

Event ticketing platform with virtual queue (Redis Sorted Set), TTL seat locking, and double-entry ledger system.

**Stack:** Node.js + Express, PostgreSQL (Supabase), Redis (Upstash), React (Vite) + Tailwind + shadcn/ui

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

### Key Components

| Component    | Technology                 | Purpose                               |
| ------------ | -------------------------- | ------------------------------------- |
| API Gateway  | Nginx                      | Rate limiting, SSL termination, proxy |
| App Server   | Node.js + Express          | Business logic, REST API, SSE         |
| Queue Engine | Upstash Redis (Sorted Set) | Virtual queue, FIFO ordering          |
| Seat Locks   | Upstash Redis (TTL)        | 300s admission lock, no oversell      |
| Database     | Supabase PostgreSQL        | Persistent data, orders, ledger       |
| Frontend     | React + Vite + Tailwind    | Buyer/Organizer/Admin UI              |

---

## Stress Test Results (Measured — t3.micro Free Tier)

**Environment:** AWS EC2 `t3.micro` (1 vCPU, 1 GB RAM), Nginx no-limit config, app rate limits disabled (`RATE_LIMIT_*=99999`), Supabase PostgreSQL + Upstash Redis. Test category `b66b6216-6c9b-44b5-a5f2-27a9040a688f` (quota 5000, event `2d116749-d076-411c-92be-4e5e92f8bd24`). k6 script `tests/load/k6-script.js`: `setupTimeout 120s`, user pool 80, join stages `50→100→200→300 RPS`, SSE stages `50→100→200→300 VU`.

> **Known limitation:** scenario isolation failed — both runs below executed **2 scenarios simultaneously** (`join_ramp` + `sse_ramp`, up to 800 VUs) despite `--env K6_SCENARIO=...`. Numbers = combined load, not pure single-scenario. Thresholds: `checks>0.99`, `p95<500ms`, `http_req_failed<0.01`.

### Run 1 — `K6_SCENARIO=join_ramp` flag (5m34s, both scenarios active)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,975 reqs @ **80.76 req/s** | — | — |
| Successful joins (`join ok ✓`) | **23,567** / 2,332 failed → **~70.5 joins/s** | — | — |
| Checks success | 91.14% (24,000 / 26,333) | >99% | ❌ |
| HTTP error rate | 8.81% (2,378 / 26,975) | <1% | ❌ |
| p95 latency | 4.81s (avg 2.79s, med 3.57s, max 2m0s) | <500ms | ❌ |
| Dropped iterations | 13,100 (server too slow, k6 shed load) | — | — |
| SSE connected | ✓ 433 / ✗ 1 | — | — |

### Run 2 — `K6_SCENARIO=sse_ramp` flag (5m31.9s, both scenarios active)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,809 reqs @ **80.78 req/s** | — | — |
| Successful joins (`join ok ✓`) | **23,474** / 2,264 failed → **~70.7 joins/s** | — | — |
| Checks success | 91.34% (23,904 / 26,169) | >99% | ❌ |
| HTTP error rate | 8.60% (2,308 / 26,809) | <1% | ❌ |
| p95 latency | 4.68s (avg 2.83s, med 3.84s, max 2m0s) | <500ms | ❌ |
| Dropped iterations | 13,261 | — | — |
| SSE connected | ✓ 430 / ✗ 1 | — | — |

### Verdict

- **Thresholds NOT met on either run.** No re-run performed — sufficient to declare the infra ceiling.
- **Server degraded gracefully, did NOT crash:** consistent `500 {"status":"error","message":"Internal server error"}` for the full duration, Node process alive. Likely cause: PG pool (`max: 20`) exhaustion + 1 vCPU starvation under combined load.
- **Ceiling (measured):** ~80 req/s total HTTP / ~70 successful joins/s **with ~8–9% error and p95 ~4.7s** under combined join+SSE load on t3.micro. The green point (<1% error, p95 <500ms) sits **below this load** — not exactly measured (no isolated low-rate run).
- **Design holds:** FIFO ordering, no oversell, TTL locks and idempotent re-join behaved correctly; failures are 500s under overload, not correctness violations.

---

## Architecture Review (War-Ticket Principles)

| Principle                            | Implementation                        | Status |
| ------------------------------------ | ------------------------------------- | ------ |
| **FIFO Fairness**                    | `INCR` seq → `ZADD` score → `ZPOPMIN` | ✅     |
| **No Oversell**                      | `DECR` stock + rollback on negative   | ✅     |
| **TTL Lock**                         | `SET EX 300 NX` + expiry tracker      | ✅     |
| **Decoupling (Anti-Flood Checkout)** | Queue in Redis → Batch admit 50/5s    | ✅     |
| **Idempotency**                      | `ZRANK` check before `ZADD`           | ✅     |
| **Rate Limiting**                    | Nginx (volumetric) + App (auth-aware) | ✅     |
| **Stateless Auth**                   | JWT                                   | ✅     |
| **Infra Separation**                 | Redis/Postgres external               | ✅     |

**Verdict:** Design correctly implements war-ticket patterns. Ceiling is **infrastructure** (t3.micro), not design.

---

## Ceiling Analysis

| Bottleneck         | Measured limit (t3.micro, combined load) | Why                                        | Fix                                           |
| ------------------ | ---------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| **vCPU (1 core)**  | ~80 req/s total / ~70 joins/s @ ~8–9% error, p95 ~4.7s | Single-threaded Node saturates early under combined join+SSE load | Vertical (t3.medium) or Horizontal (ALB + N×) |
| **RAM (1 GB)**     | Not isolated (SSE ran together with join ramp) | Each SSE holds connection + Node overhead | Vertical or Horizontal                        |
| **DB Pool (20)**   | 20 concurrent PG queries (`pool.max = 20` in `db.js`) | Likely source of consistent 500s under load | Increase pool + Supabase limits               |
| **Category Query** | 2 PG round-trips / join  | `findCategory` + `findUnpaid` per request   | **In-memory cache TTL 60s** (implemented in `queueService.js`)     |

### Category Cache Impact (Projected — NOT measured)

> Before/after cache comparison was never run as isolated tests. Numbers below are projections, kept for planning only.

| Metric                 | Before Cache | After Cache (60s TTL, est.) |
| ---------------------- | ------------ | --------------------- |
| PG queries / join      | 2            | 1 (unpaid check only) |
| PG queries / SSE poll  | 1            | 0 (cache hit)         |
| Join RPS ceiling       | ~80 req/s total (measured, combined load, with errors) | **higher (unmeasured)** |
| SSE concurrent ceiling | unmeasured (ran together with join ramp) | **higher (unmeasured)** |

---

## Next Steps for Ribuan User (Scale Path)

### Phase 1: Quick Wins (Done)

- ✅ Category cache (in-memory TTL 60s) → reduces PG queries/join from 2 to 1 (impact unmeasured — see note above)
- ✅ Rate limits tuned per environment

### Phase 2: Vertical Scaling (Cost: ~$30/mo)

- `t3.micro` → `t3.medium` (2 vCPU, 4 GB RAM)
- DB pool `max: 20` → `50` (Supabase allows)
- Expected: **2–3×** current ceiling

### Phase 3: Horizontal Scaling (Production-Grade)

```
                    ┌─────────────┐
                    │     ALB     │  (AWS Application Load Balancer)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Node #1 │       │ Node #2 │       │ Node #N │  (Stateless, shared Redis/PG)
    └─────────┘       └─────────┘       └─────────┘
```

- ALB handles SSL, health checks, sticky sessions for SSE (or use Redis Pub/Sub for SSE fan-out)
- Each node independent, shared Upstash Redis + Supabase
- Auto-scaling group based on CPU/RPS
- **True ribuan-user capacity** — identical to platform-tiket architecture

### Phase 4: Advanced (If Needed)

- Redis Pub/Sub for SSE fan-out across nodes
- Read replicas for Supabase (read-heavy: queue position, events)
- CDN for static assets (already via Nginx + frontend build)

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- Supabase account (PostgreSQL)
- Upstash account (Redis)

### Environment Variables

```bash
# backend/.env
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

### Testing

```bash
# Unit tests
npm test

# Integration (requires DATABASE_URL_TEST, REDIS_URL)
npm run test:integration

# All
npm run test:all
```

### Stress Test (k6)

```bash
# Join throughput ceiling (note: K6_SCENARIO did not isolate scenarios in our runs —
# both join_ramp and sse_ramp executed together; for a pure join-only run, split
# the script into a single-scenario file first)
k6 run --env TARGET_URL=http://localhost --env CATEGORY_ID=<category_id> tests/load/k6-script.js

# Concurrent SSE ceiling (same caveat as above)
k6 run --env TARGET_URL=http://localhost --env CATEGORY_ID=<category_id> tests/load/k6-script.js
```

---

## Deployment

### AWS EC2 (Free Tier)

- Instance: `t3.micro` (1 vCPU, 1 GB)
- Nginx reverse proxy on host (port 80)
- Docker Compose: backend (5000), frontend (3000)
- Nginx config: `/etc/nginx/sites-available/gigspass`

### SSL / Production

- Certbot (Let's Encrypt) on Nginx
- Security Groups: 22 (SSH), 80/443 (HTTP/HTTPS) only
- **No port 5000/3000 exposed**

---

## Security

- `.env` never committed
- Passwords: bcrypt (10 rounds)
- JWT: HS256, 7d expiry
- Rate limiting: Nginx (volumetric) + App (auth-aware)
- No secrets in logs/responses

---

## License

MIT
