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
- Queue sequence counter: `queue:seq` (monotonic INCR — dipakai sebagai score ZADD agar FIFO ketat, bukan Date.now)
- Seat lock with TTL: `lock:category:{category_id}:buyer:{user_id}` (general admission — lock per buyer, bukan per seat; TTL 300s)
- Lock expiry tracker (Sorted Set, untuk cleanup lock yang ditinggalkan): `lockexpiry:category:{category_id}` (member `user_id`, score = epoch ms saat lock akan kedaluwarsa)
- Granted marker (bukti buyer lolos dequeue): `granted:category:{category_id}:buyer:{user_id}` (TTL 300s)
- Atomic stock counter: `stock:category:{category_id}`

**NOT used for:** general cache, session storage, or anything else.

### Queue & SSE Design (Fase 4)
- `joinQueue` — `ZADD` member `userId`, score dari `INCR queue:seq`. Re-join idempotent (jika sudah ada, tidak ZADD ulang).
- `dequeueBatch` — `ZPOPMIN` N buyer, cap batch dengan sisa `stock:category:{id}`. Setiap buyer yang di-admit langsung ditandai `granted:category:{id}:buyer:{uid}` (SET EX 300) sebagai bukti lolos antrian. Dipanggil scheduler `src/jobs/queueDequeuer.js` (batch 50, interval 5s, override via env).
- SSE `GET /api/queue/:categoryId/stream` — **auth via Bearer header** (`authenticate` biasa), BUKAN token di URL. Tidak ada SSE token terpisah — cukup session JWT. Frontend memakai `@microsoft/fetch-event-source` (header custom + auto-reconnect). Event: `position` (perubahan posisi) lalu `granted` (user keluar antrian) lalu koneksi ditutup.
- Checkout (general admission, Fase 5): `reserveSlot` — cek `granted` ada → `SET lock:category:{id}:buyer:{uid} EX 300 NX` → `DECR stock` → `ZADD lockexpiry:category:{id}` (score = now + 300s). Bayar sukses → `confirmSlot` (hapus lock + ZREM, stock TETAP turun). Gagal/TTL → `releaseSlot` (hapus lock + `INCR stock` + ZREM). One-shot admission: buyer yang gagal bayar harus join antrian lagi.
- Lock cleanup: dipanggil di awal `processQueueForCategory` di `src/jobs/queueDequeuer.js` (bukan job terpisah) — tiap tick (interval 5s, sama dengan dequeue) `ZRANGEBYSCORE lockexpiry:category:{id} 0 <now>` → tiap buyer yang lock-nya kedaluwarsa di-`DEL` lock + `INCR stock` + `ZREM`, dan order `awaiting_payment`-nya di-mark `expired`. Cleanup jalan SEBELUM `dequeueBatch` membaca stock, jadi admission selalu pakai angka stock yang segar. Logika cleanup ada di `lockService.cleanupExpiredLocks`. `queueDequeuer.run()` punya anti-overlap guard (`if (running) return`).

### Ledger System
- Double-entry bookkeeping — every transaction touches min 2 accounts
- 4 account types: `buyer_wallet`, `organizer_pending`, `organizer_available`, `platform_revenue`
- `ledger_entries` table is **immutable** — no UPDATE/DELETE, corrections via reversing entries
- Order/fund status lives in `orders.status`, NOT in `ledger_entries` — ledger only records financial events
- `orders.amount` = snapshot `ticket_categories.price` saat create order (Fase 7) — ledger pakai nilai ini, aman walau harga kategori diubah organizer
- Komisi platform: `PLATFORM_COMMISSION_PERCENT` (default 10%) di `src/config/constants.js`
- Pembayaran sukses → `withTransaction` (helper di `src/config/db.js`): `markPaid` + `ledgerService.recordPaymentSplit` (debit `buyer_wallet` = amount, kredit `organizer_pending` = amount − komisi, kredit `platform_revenue` = komisi) — semua dalam 1 `BEGIN...COMMIT`
- Release dana (Fase 8) → `recordRelease` saat holding_period habis: debit `organizer_pending` + kredit `organizer_available` (jumlah = bagian organizer)
- Refund (Fase 8) → `recordRefund` saat event di-cancel atau admin override: kredit `buyer_wallet` (= amount), debit `organizer_pending` (bagian organizer), debit `platform_revenue` (komisi) — reversing entry yang menyeimbangkan transaksi pembayaran asli. Semua refund memakai **satu status terminal `refunded`**; penyebabnya disimpan di kolom `orders.refund_reason` (nullable, hanya terisi saat `refunded`): `event_cancelled` (event dibatalkan resmi sebelum digelar — bulk, semua order dibayar langsung di-reverse) atau `admin_override` (putusan admin per order selama holding_period). Order hasil cancel TIDAK pernah masuk holding_period (`holding_until` NULL); order hasil override pernah (`holding_until` terisi). Tidak ada tahap refund terpisah — entry reversal dibuat se-transaksi dengan perubahan status.
- `ledgerModel` TIDAK mengekspos fungsi update/delete — enforce immutability di service layer juga (assert desain, bukan cuma DB constraint)

### Roles (hardcoded, not dynamic RBAC)
- `buyer` — browse events (public), checkout (auth required)
- `organizer` — create/manage events, view sales dashboard
- `admin` — approve events, manual override order status, platform analytics

### Order Status Flow
```
awaiting_payment (dibuat saat lock berhasil, BELUM bayar)
   ├── bayar sukses   → pending (dana masuk, menunggu event_date)
   └── gagal / TTL    → expired (lock lepas, stock balik ke pool)
pending → holding_period (after event_date, via job orderLifecycle, holding_until = +7 hari)
              ├── released (after 7 days, no issue, + recordRelease ledger)
              ├── held (admin manual override POST /api/admin/orders/:id/override — ONLY valid while status = holding_period; dana tetap escrow)
              └── refunded (status TUNGGAL dana dikembalikan — via cancel event ATAU admin override, + recordRefund; see refund_reason)
```
`pending` = sudah dibayar (PRD: "dana masuk") — order yang belum bayar memakai `awaiting_payment`, bukan `pending`. `paid_at` (nullable) mencatat kapan pembayaran berhasil. Transisi `pending→holding_period` dan `holding_period→released` dijalankan `src/jobs/orderLifecycle.js` (interval `ORDER_LIFECYCLE_INTERVAL_MS`, default 24 jam).

### Event Status Flow (Limited Lifecycle)
Event status hanya dapat diintervensi **SEBELUM event_date**. Setelah event digelar, intervensi pindah ke order flow:

```
draft → published (organizer)
              ├── suspended (admin — violation investigasi, belum digelar)
              │    ├── published (admin unsuspend, clear)
              │    └── cancelled (admin confirmed batal) → trigger refunded (refund_reason='event_cancelled') di semua orders
              └── cancelled (organizer/admin langsung) → trigger refunded (refund_reason='event_cancelled') di semua orders terkait

SETELAH event_date LEWAT:
  Event status: TIDAK BERUBAH (biarkan as-is)
  Yang berjalan: Order status flow (holding_period → released/held/refunded)
  Violation/dispute: ditangani via admin override di orders
```

### Event Status Constraints
- `suspended`/`cancelled` hanya valid kalau `event_date > NOW()` (belum digelar)
- Organizer bukan pemilik → update event gagal (403)
- `publish` → hanya dari status `draft`
- `suspend` → hanya dari status `published`, hanya admin
- `cancel` → hanya dari status `published`/`suspended`, hanya organizer/admin, dan hanya jika belum digelar
- `suspended` **tidak** trigger refund (hanya review sementara)
- `cancelled` **wajib** trigger `refunded` (refund_reason='event_cancelled') di semua orders terkait

## API Response Convention (envelope format)

Semua endpoint backend harus mengembalikan respons dengan envelope yang konsisten:

### Success
```json
{
  "status": "success",
  "message": "<deskripsi singkat>",
  "data": { }
}
```

### Error
```json
{
  "status": "error",
  "message": "<alasan kegagalan>"
}
```

### Aturan
- HTTP status code tetap mencerminkan hasil (2xx success, 4xx client error, 5xx server error) — jangan duplikasi di field `status`
- Field `status` di body membedakan success/error, bukan menggantikan HTTP code
- Semua payload business logic ada di `data` (kecuali error — tanpa `data`)
- Berlaku untuk SEMUA endpoint ke depan (auth, events, categories, queue, orders, ledger, analytics)
- Response tidak pernah mengekspos password/hash

## Design System

Frontend must follow `docs/design/design.md`:
- Canvas: Cream-tinted white (`#fffaf0`) — warm & playful for event/festival vibe
- Primary CTA: Near-black (`#0a0a0a`)
- Feature cards: 6-color saturated palette (pink `#ff4d8b`, teal `#1a3a3a`, lavender `#b8a4ed`, peach `#ffb084`, ochre `#e8b94a`, mint `#a4d4c5`)
- Typography: Inter 500 (display, with negative letter-spacing) / Inter 400 (body)
- Border radius: `rounded.md` (12px) for CTAs & inputs, `rounded.lg` (16px) for content cards, `rounded.xl` (24px) for feature cards
- Vibe: Vibrant, playful, festival-energy — not minimal or editorial
- Component variants: feature cards must cycle through 6-color palette (never repeat same color twice in row)

## Development Workflow

### Strict Execution & Git Rules
1. **Tidak Ada Eksekusi Otomatis:** DILARANG mengeksekusi kode, membuat file, atau mengubah sistem tanpa perintah/persetujuan eksplisit dari User per unit kerja.
2. **Konfirmasi Sebelum Commit & Push:** WAJIB menanyakan dan meminta konfirmasi persetujuan dari User terlebih dahulu sebelum menjalankan perintah `git commit` maupun `git push`.

### Task Execution
Follow `docs/TASK_BREAKDOWN.md` phase order — do not skip phases unless independent.

Each checklist item = 1 unit of work = 1 commit.

### Before Committing
1. Run tests (when available): `npm test` (unit) dan `npm run test:integration` (real DB) — atau `npm run test:all` untuk keduanya
2. Run lint (when available): `npm run lint`
3. Verify no `.env` committed

### Commit & Push Protocol (ABSOLUTE — NO EXCEPTIONS)

**This protocol is persistent across all sessions. Follow strictly regardless of session memory.**

**BEFORE ANY `git commit` OR `git push`:**

1. **Summarize files** being committed (list files or describe change scope)
2. **Show commit message** that will be used (exact format: `<type>: <description>`)
3. **ASK USER explicitly:** "Apakah saya boleh commit dengan pesan: `<type>: <description>`?"
4. **WAIT for user confirmation** — DO NOT PROCEED without explicit "yes", "setuju", "lanjut", or similar approval
5. **ONLY THEN execute** `git commit`
6. **For push:** After commit succeeds, **ASK AGAIN** "Apakah saya boleh push ke origin/main?"
7. **WAIT for user confirmation** — DO NOT PUSH without explicit approval
8. **ONLY THEN execute** `git push origin main`

**CRITICAL CONSTRAINTS:**
- ❌ NEVER combine commit + push in single bash command (must be separate steps with confirmation between them)
- ❌ NEVER batch multiple commits without individual confirmation per commit
- ❌ NEVER assume "execute phase X" means "commit and push automatically"
- ❌ NEVER skip the ASK step even if changes seem minor or obvious
- ✅ ALWAYS treat ASK step as mandatory, non-negotiable checkpoint

**Why this protocol exists:**
- Lack of memory across sessions means agent must rely on explicit written rules
- User must have visibility and control over every git operation
- This ensures accountability and prevents accidental commits/pushes

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

### Cara Menjalankan Test
- `npm test` — unit test cepat (pakai `mockDb`, tanpa DB asli)
- `npm run test:integration` — integration test terhadap **DB & Redis nyata** (`jest.config.integration.js`, `--runInBand`); migration dijalankan otomatis ke test DB oleh `globalSetup`
- `npm run test:all` — keduanya berurutan
- Prasyarat integration test (dari `backend/.env`): `DATABASE_URL_TEST` (test DB terpisah, mis. Neon branch), `DATABASE_SSL=true`, `REDIS_URL` (Upstash)
- Kalau `DATABASE_URL_TEST` kosong, `test:integration` gagal dengan pesan jelas — jangan dianggap bug aplikasi

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
