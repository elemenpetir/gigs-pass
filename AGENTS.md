Always respond in Bahasa Indonesia, regardless of the language used in this file.

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
│   ├── pages/        # Route-level pages, dipisah per role:
│   │   ├── auth/        # LoginPage
│   │   ├── public/      # Home, EventsPage, EventDetailPage (tanpa login)
│   │   ├── buyer/       # WaitingRoom, Checkout, OrderHistory, OrderDetail
│   │   ├── organizer/   # Events, EventForm, Categories, EventOrders
│   │   └── admin/       # AdminEvents, AdminOrders, AdminAnalytics
│   ├── hooks/        # Custom hooks (SSE connection, etc)
│   └── lib/          # API client, utilities
```

## Product Constraints (sumber: docs/PRD.md dan docs/DECISIONS.md)

Aturan bisnis lengkap tinggal di dua file itu. Wajib dibaca sebelum menulis kode:
- `docs/PRD.md` - blueprint: problem, scope MVP, endpoint, data model, alur dana, deployment.
- `docs/DECISIONS.md` - keputusan desain selama implementasi (format Tanggal/Konteks/Keputusan/Konsekuensi).

Contekan invarian (tidak boleh dilanggar, detail di dua file di atas):
- Redis HANYA untuk: virtual queue (Sorted Set), counter `queue:seq`, lock TTL 300s, tracker `lockexpiry`, counter `stock`. Bukan cache/session. Pengecualian: cache in-memory process-local untuk referensi praktis imutabel (mis. `ticket_categories`, TTL 60s).
- Ledger immutable: tanpa UPDATE/DELETE, koreksi via reversing entry. 4 akun tetap: `buyer_wallet`, `organizer_pending`, `organizer_available`, `platform_revenue`. Status dana di `orders.status`, bukan di ledger.
- Role hardcoded: `buyer`, `organizer`, `admin`. Bukan dynamic RBAC.
- Response envelope success/error untuk semua endpoint. Tanpa password/hash di respons.
- Tambah/ubah kategori event = backend `constants.js` + frontend `lib/categories.js` + migration CHECK (lihat DECISIONS #11).

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
3. **Jangan Otomatis Kerjakan Task Berikutnya Setelah Push:** SETELAH `git push` berhasil, STOP. Jangan langsung mengeksekusi task/unit kerja berikutnya tanpa instruksi eksplisit dari User. Selalu tunggu perintah baru untuk melanjutkan.

### Task Execution
Follow `docs/TASK_BREAKDOWN.md` phase order — do not skip phases unless independent.

Each checklist item = 1 unit of work = 1 commit.

> **CI hemat:** commit yang hanya menyentuh docs (`**.md`, `docs/**`, `deploy/**`, `tests/load/**`) otomatis **melewati CI/CD** via `paths-ignore` di `.github/workflows/ci.yml` — tidak ada run Actions dan tidak ada redeploy. Kalau tidak ada run setelah push docs-only, itu normal, bukan error.

### Before Committing
1. Run tests (when available): `npm test` (unit) dan `npm run test:integration` (real DB) — atau `npm run test:all` untuk keduanya
2. Run lint (when available): `npm run lint` (sudah include `.jsx` via `eslint src/ --ext .js,.jsx --fix` — jangan diubah ke `eslint src/` polos, itu tidak akan melint file `.jsx`)
3. Verify no `.env` committed

> **Ritme verifikasi frontend:** `npm run build` wajib **1x di titik commit** per unit kerja (bukan di sela sub-langkah); lint boleh di sela perubahan besar. Perubahan docs-only tidak perlu build. `npm run build` ~1–2 detik di project ini — cepat, jangan dilewati saat commit kode frontend (validasi utility Tailwind/`@theme` hanya muncul di build). Catatan: `npm run build` memuat warning Tailwind rope/bare-value bila ada kelas yang bisa disingkat (mis. `rotate-[-1deg]` → `-rotate-1`, `aspect-[4/3]` → `aspect-4/3`) — konversi hanya untuk kelas yang nilai CSS-nya setara persis, jangan konversi sembarangan (mis. `leading-[0.9]` ≠ `leading-<n>` di v4).

### Commit & Push Protocol (ABSOLUTE — NO EXCEPTIONS)

**This protocol is persistent across all sessions. Follow strictly regardless of session memory.**

**BEFORE ANY `git commit` OR `git push`:**

1. **Summarize files** being committed (list files or describe change scope)
2. **Show commit message** that will be used (exact format: `<type>: <description>`)
3. **ASK USER explicitly:** "Apakah saya boleh commit & push dengan pesan: `<type>: <description>`?"
4. **WAIT for user confirmation** — DO NOT PROCEED without explicit "yes", "setuju", "lanjut", or similar approval
5. **ONLY THEN execute** `git commit` lalu `git push origin main` (commit+push adalah SATU proses yang dikonfirmasi sekaligus — SATU pertanyaan saja, tidak dipisah jadi 2 konfirmasi)

**CRITICAL CONSTRAINTS:**
- ❌ NEVER commit/push without the single combined ASK (one confirmation covers both commit & push)
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

**Pelajaran metodologi (insiden terukur):** `--env K6_SCENARIO=<nama>` TIDAK mengisolasi skenario — k6 mengeksekusi SEMUA skenario di `options.scenarios` (terbukti: flag `join_ramp`/`sse_ramp` tetap menjalankan keduanya, 800 VU gabungan). Untuk run terpisah, pisah jadi file single-scenario (mis. `k6-join-only.js`, `k6-sse-only.js`). Angka ceiling hanya valid bila beban yang diukur memang terisolasi — selalu catat caveat bila tidak.

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
