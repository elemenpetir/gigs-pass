# Gigs Pass — Agent Instructions

## Project Overview

Event ticketing platform with virtual queue (Redis Sorted Set), TTL seat locking, and double-entry ledger system.

**Stack:** Node.js + Express, PostgreSQL (Supabase/Neon), Redis (Upstash), React (Vite) + Tailwind + shadcn/ui

## Architecture

### Backend Structure (MVC + Service Layer)
```
backend/
├── src/
│   ├── routes/        # Express route definitions
│   ├── controllers/   # Request handling, validation
│   ├── services/      # Business logic, transactions
│   ├── models/        # Raw SQL queries per table (no business logic here)
│   ├── middlewares/   # Auth, authorization, error handling
│   ├── config/        # Database, Redis clients, constants
│   ├── jobs/          # Scheduled background jobs
│   └── utils/         # Helper utilities
├── migrations/        # node-pg-migrate files
├── package.json
└── .env.example
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/   # Reusable UI (shadcn/ui based)
│   ├── pages/        # Route-level pages
│   ├── hooks/        # Custom hooks (SSE connection, etc)
│   └── lib/          # API client, utilities
```

## Key Constraints (from PRD)

### Redis Usage — ONLY for:
- Virtual queue (Sorted Set): `queue:event:{event_id}:{category_id}`
- Seat lock with TTL: `lock:category:{category_id}:seat:{seat_no}`
- Atomic stock counter: `stock:category:{category_id}`

**NOT used for:** general cache, session storage, or anything else.

### Ledger System
- Double-entry bookkeeping — every transaction touches min 2 accounts
- 4 account types: `buyer_wallet`, `organizer_pending`, `organizer_available`, `platform_revenue`
- `ledger_entries` table is **immutable** — no UPDATE/DELETE, corrections via reversing entries
- Order/fund status lives in `orders.status`, NOT in `ledger_entries` — ledger only records financial events

### Roles (hardcoded, not dynamic RBAC)
- `buyer` — browse events (public), checkout (auth required)
- `organizer` — create/manage events, view sales dashboard
- `admin` — approve events, manual override order status, platform analytics

### Order Status Flow
```
pending → holding_period (after event_date)
              ├── released (after 7 days, no issue)
              ├── refund_triggered (organizer cancels event officially)
              └── held / refunded (admin manual override — ONLY valid while status = holding_period)
```

## Design System

Frontend must follow `docs/design/design.md`:
- Colors: primary black `#000000`, text-link blue `#0d74ce` (inline links only)
- Typography: Inter (display 600, body 400), JetBrains Mono (code)
- CTAs: `rounded.md` (8px), never pill shape
- No saturated brand colors — black CTAs only

## Development Workflow

### Strict Execution & Git Rules
1. **Tidak Ada Eksekusi Otomatis:** DILARANG mengeksekusi kode, membuat file, atau mengubah sistem tanpa perintah/persetujuan eksplisit dari User per unit kerja.
2. **Konfirmasi Sebelum Commit & Push:** WAJIB menanyakan dan meminta konfirmasi persetujuan dari User terlebih dahulu sebelum menjalankan perintah `git commit` maupun `git push`.

### Task Execution
Follow `docs/TASK_BREAKDOWN.md` phase order — do not skip phases unless independent.

Each checklist item = 1 unit of work = 1 commit.

### Before Committing
1. Run tests (when available): `npm test`
2. Run lint (when available): `npm run lint`
3. Verify no `.env` committed

### Commit Convention

Follow Conventional Commits format: `<type>: <description>`

Types used in this project:
- `feat:` — new feature/endpoint/functionality
- `fix:` — bug fix
- `docs:` — documentation only (PRD, README, AGENTS.md, etc)
- `test:` — adding/updating tests
- `chore:` — tooling, config, dependencies (no production code change)
- `refactor:` — code change that doesn't add feature or fix bug

Each commit should correspond to ONE checklist item in `docs/TASK_BREAKDOWN.md`.
Do not bundle multiple unrelated checklist items into a single commit.

Example: `feat: add seat lock with TTL via Redis`
Example: `test: add unit test for ledger entry balance validation`

## Database Migrations

Using `node-pg-migrate`. Migration files should already exist (check with user if not found).

Run against Supabase/Neon via `DATABASE_URL` env var.

## Testing Requirements (from PRD)

### Unit/Integration Tests
- Auth (register/login)
- Event CRUD + authorization
- Queue join/position
- Seat lock success/expired
- Ledger balance (debit = kredit)
- Refund flow on event cancel

### Stress Testing (k6)
Must prove:
1. No overselling under concurrent load
2. FIFO queue ordering holds
3. TTL expiry releases locks correctly
4. Response time acceptable (p95/p99)

Document results in README with concrete numbers.

## Security

- `.env` never committed
- Passwords hashed with bcrypt
- All protected routes use JWT middleware
- No secrets in logs or responses

## Deployment

- Docker Compose (backend + frontend, Redis/Postgres external)
- AWS EC2 (t2.micro/t3.micro)
- Nginx reverse proxy
- CORS + SSE must work in production

## Out of Scope (MVP)

- Xendit sandbox (mock payment only)
- Dynamic RBAC
- Customer-triggered dispute window
- WebSocket (SSE only)
- Email/push notifications

## Learning & Adaptation

### Critical Rule: Learn from Mistakes Immediately
- When an error occurs, identify the root cause and apply the fix WITHIN THE SAME SESSION.
- Do NOT repeat the exact same error a second time — if you catch yourself about to make the same mistake again, STOP immediately.
- If you make the same mistake twice, it indicates a failure to learn and adapt. This is unacceptable.
- Always maintain awareness of corrections made and apply them consistently for the rest of the session.
