# Gigs Pass

> **Read in English:** [README.md](./README.md). Versi Inggris adalah source of truth; jika ada perbedaan, versi Inggris yang berlaku.

Platform ticketing event yang dibangun untuk trafik flash-sale: buyer masuk antrean virtual yang adil, diterima sesuai urutan FIFO, memegang slot berbatas waktu, lalu membayar. Organizer mengelola event dan memantau revenue lewat ledger double-entry. Tanpa overselling, tanpa checkout yang crash, tanpa bot yang menyerobot antrean.

**Masalah yang saya selesaikan:** ticket drop dengan demand tinggi gagal dengan pola yang bisa ditebak. Banjir checkout menumbangkan server, race condition menjual stok melebihi kuota, dan bot menyingkirkan fans asli. Gigs Pass menjawab masing-masing dengan mekanisme spesifik: antrean virtual berbasis Redis menyerap banjir, operasi stok atomik membuat oversell mustahil, lock TTL mendaur ulang slot yang ditinggalkan, dan rate limit per-user menahan bot.

**Stack:** Node.js + Express, PostgreSQL (Supabase), Redis (Upstash), React (Vite) + Tailwind, Nginx, Docker, AWS EC2, GitHub Actions (CI/CD ke GHCR + EC2).

---

## Peran dan Lingkup

Dibangun solo end to end: API backend dan business logic, flow frontend buyer/organizer/admin, automated testing, pipeline CI/CD, cloud deployment, dan load testing. Lingkup generalist, kedalaman backend.

---

## Demo Langsung

- **App:** http://13-214-56-223.nip.io (instance demo di AWS free tier)
- Registrasi terbuka, jadi buat akun buyer dan coba flow antreannya sendiri: pilih event, join queue, pantau posisimu yang update live, checkout saat diterima.
- Lebih suka jalan lokal? Lihat [Persiapan Development](#persiapan-development).

---

## Tangkapan Layar

<!-- TODO: add screenshots
- docs/screenshots/dashboard.png - organizer sales dashboard
- docs/screenshots/waiting-room.png - buyer waiting room with live position
- docs/screenshots/checkout.png - checkout with lock countdown
-->

---

## Keputusan Engineering Kunci

Setiap keputusan di bawah mencantumkan alternatif yang saya pertimbangkan dan kenapa saya memilih yang saya pilih.

### 1. Antrean FIFO di Redis Sorted Set (skor dari INCR atomik, bukan timestamp)

Alternatif: tabel antrean di database, skor timestamp, antrean in-memory di Node.
Kenapa ini: `INCR queue:seq` menghasilkan urutan monotonik tanpa celah, sehingga ordering skor `ZADD` FIFO secara ketat bahkan di bawah join konkuren. `ZPOPMIN` menerima dari depan dalam O(log N). Tabel database akan menyerikan tiap join pada row lock; antrean in-memory mati bersama proses dan merusak horizontal scaling. Re-join idempoten (cek `ZRANK` sebelum `ZADD`) berarti retry tidak pernah menduplikat buyer.

### 2. Admission sama dengan lock (TTL 300 detik, diset saat momen dequeue)

Alternatif: marker "granted" terpisah diikuti langkah lock belakangan saat checkout.
Kenapa ini: menggabung admission dan locking jadi satu langkah atomik (`SET lock EX 300 NX` + `DECR stock`, dengan rollback `INCR` + `DEL` saat stok negatif) menutup loophole re-lock dan menghapus satu round trip penuh. Satu grant sama dengan satu kesempatan: gagal bayar atau biarkan TTL kedaluwarsa, dan kamu antre ulang. Lock kedaluwarsa dibersihkan tiap tick dequeue dan stoknya kembali ke pool dalam hitungan detik.

### 3. Ledger double-entry, entry immutable

Alternatif: kolom balance mutable di baris akun, satu log transaksi tunggal.
Kenapa ini: tiap pergerakan uang menulis baris debit/kredit berimbang yang tidak bisa di-update atau dihapus (koreksi lewat reversing entry). Balance selalu diturunkan dari `SUM`, sehingga uang tidak bisa melenceng dari riwayat. Audit pasca-beban pada data produksi mengonfirmasinya: debit Rp500.000 sama dengan kredit Rp500.000 persis, nol order berbayar tanpa entry, nol order unbalanced. Lihat [Audit Ledger Pasca-Beban](#audit-ledger-pasca-beban).

### 4. SSE ketimbang WebSocket untuk waiting room

Alternatif: WebSocket, polling.
Kenapa ini: waiting room satu arah (server mendorong update posisi). SSE berjalan di atas HTTP polos, sehingga lewat Nginx dan middleware auth tanpa infrastruktur tambahan, dan reconnect secara native. Frontend memakai `@microsoft/fetch-event-source` bukan `EventSource` native karena EventSource native tidak bisa mengirim header Bearer, yang wajib untuk endpoint stream terautentikasi.

### 5. Rate limiting yang sadar auth (limit join per-user, limit global per-IP)

Alternatif: satu limiter global per-IP, tanpa limiter di join.
Kenapa ini: limit join per-IP menghukum kantor dan kampus di balik satu alamat NAT. Limiter join memakai kunci `user:id` (setelah autentikasi, kebal NAT) di 30/menit, sementara lapisan global dan Nginx tetap per-IP di 600/menit untuk banjir volumetrik. Login hanya menghitung yang gagal (`skipSuccessfulRequests`), sehingga user normal tidak pernah menghabiskan jatah.

### 6. Cache referensi in-memory ketimbang Redis tambahan atau query tambahan

Alternatif: cache kategori di Redis, atau terus query Postgres per request.
Kenapa ini: kategori tiket praktisnya data referensi immutable. `Map` process-local dengan TTL 60 detik di `queueService.js` memangkas query Postgres per join dari 2 jadi 1 dengan nol network hop dan nol infrastruktur baru. Larangan pemakaian Redis (hanya queue, lock, dan counter stok) tetap utuh.

### 7. Deploy image GHCR via CI/CD (tanpa build di server)

Alternatif: `git pull` + `docker compose build` di EC2.
Kenapa ini: CI membangun image backend dan frontend sekali, push ke GHCR, dan CD menariknya ke EC2 via SSM. Server tidak menyimpan source code, toolchain, maupun secret build-time. Tiap container produksi bisa dilacak ke hash commit, dan begitulah cara saya memverifikasi deploy cache (digest image cocok, tanpa tebak-tebak SSH).

---

## Gambaran Arsitektur

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

## Performa Terukur (k6, AWS t3.micro Free Tier)

Saya load-test sistem yang ter-deploy ketimbang menebak. Lingkungan: EC2 `t3.micro` (1 vCPU, 1 GB RAM), rate limit dilonggarkan untuk test, backend Supabase + Upstash, kuota kategori test 5000, pool user k6 80, ramp join 50 ke 300 RPS plus ramp SSE konkuren.

> Keterbatasan yang diketahui: isolasi skenario gagal, sehingga kedua run di bawah mengeksekusi beban join dan SSE bersamaan (hingga 800 VU). Perlakukan angkanya sebagai beban gabungan. Threshold: checks di atas 99 persen, p95 di bawah 500ms, error di bawah 1 persen.

### Run 1, flag fokus-join (5m34s)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,975 reqs at **80.76 req/s** | - | - |
| Successful joins | **23,567** / 2,332 failed (about 70.5 joins/s) | - | - |
| Checks success | 91.14% | above 99% | Fail |
| HTTP error rate | 8.81% | below 1% | Fail |
| p95 latency | 4.81s (avg 2.79s) | below 500ms | Fail |
| Dropped iterations | 13,100 (server too slow, k6 shed load) | - | - |

### Run 2, flag fokus-SSE (5m31.9s)

| Metric | Value | Threshold | Status |
| ------ | ----- | --------- | ------ |
| HTTP throughput | 26,809 reqs at **80.78 req/s** | - | - |
| Successful joins | **23,474** / 2,264 failed (about 70.7 joins/s) | - | - |
| Checks success | 91.34% | above 99% | Fail |
| HTTP error rate | 8.60% | below 1% | Fail |
| p95 latency | 4.68s (avg 2.83s) | below 500ms | Fail |
| Dropped iterations | 13,261 | - | - |

### Arti Angka-Angka Ini

Threshold tidak terpenuhi di kedua run, dan itu sendiri temuannya: ceiling di instance micro gratis ada di sekitar 80 req/s beban gabungan, dengan pool database (max 20) dan single vCPU sebagai bottleneck. Yang lebih penting dari ceiling:

- **Nol kegagalan correctness di beban berapa pun.** Nol oversell (stok habis tepat di kuota), FIFO bertahan di 26k+ request per run, lock kedaluwarsa mengembalikan stok ke pool.
- **Degradasi anggun, bukan crash.** Overload menghasilkan error 500 JSON yang rapi dengan proses tetap hidup sepanjang run, tanpa hang atau korupsi.
- **Kesimpulan: ceiling-nya infrastruktur, bukan desain.** Kode yang sama di instance lebih besar menaikkan throughput; tidak ada hasil yang menunjuk bottleneck logika.
- **Caveat rate-limit:** kedua run berasal dari satu egress IP dengan limit dilonggarkan, sehingga angka error/latensi ini tidak boleh dipakai ulang untuk tuning limiter per-IP - default app divalidasi terpisah lewat synthetic test.

### Audit Ledger Pasca-Beban

Setelah 50k+ request load-test terhadap data produksi, saya menjalankan query integritas read-only di Supabase:

- Balance double-entry global: debit Rp500.000 sama dengan kredit Rp500.000 persis (5 split pembayaran: 5 debit, 10 kredit)
- Order yang dibuat user load-test: nol (load tidak pernah menyentuh checkout, sesuai desain)
- Order unbalanced: nol. Order berbayar tanpa ledger entry: nol.
- Stok kategori stress utuh: kuota 5000, nol berbayar, nol pending

---

## Cakupan Test

- **271 unit test**, semuanya lolos (service, model, middleware, job, logika queue/lock/ledger dengan DB mock)
- **Suite integrasi** terhadap PostgreSQL dan Redis asli (migration otomatis diterapkan ke database test terpisah)
- **Load test k6** seperti di atas, hasilnya dicatat di file ini
- CI menjalankan unit, integrasi, lint frontend, dan production build tiap push; image dikirim ke GHCR hanya saat semua hijau

```bash
# Backend unit tests (mocked DB, fast)
cd backend && npm test

# Integration (needs DATABASE_URL_TEST, REDIS_URL)
cd backend && npm run test:integration

# All
cd backend && npm run test:all
```

---

## Referensi API

Base URL: `/api`. Semua respons memakai envelope `{status, message, data}`. Route protected memakai Bearer JWT.

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

## Persiapan Development

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
- Docker Compose: backend (5000), frontend (3000); Redis/Postgres eksternal
- CI membangun image GHCR saat pipeline hijau; CD deploy ke EC2 via SSM dengan health check
- Security Groups: 22 (SSH), 80/443 saja. Tanpa port app yang terekspos
- Runbook lengkap: `docs/deployment.md`

---

## Keamanan

- `.env` tidak pernah di-commit; secret hanya di environment
- Password: bcrypt (10 rounds); JWT HS256, expiry 7 hari
- Rate limiting: volumetrik Nginx + app yang sadar-auth (join per-user, login hitung-gagal-saja)
- Tanpa secret di log maupun respons; test bypass hardcoded sudah dihapus

---

## Yang Akan Saya Lakukan Berikutnya

1. **Scale vertikal dulu** (`t3.medium`, pool 20 ke 50): kenaikan ceiling 2 sampai 3x termurah, cocok dengan bottleneck terukur.
2. **Scale horizontal** (ALB + N node stateless): butuh rate limit store berbasis Redis dan SSE sticky session atau fan-out pub/sub.
3. **Ukur dampak cache**: run before/after terisolasi untuk cache kategori in-memory.
4. **Keraskan temuan load testing**: file k6 single-scenario yang terisolasi; default rate-limit app (10/10/30/600) sudah divalidasi sintetis (`rateLimiter.defaults.test.js` - pola sah lolos dengan nol 429, pola abuse diblokir), tuning nginx/CGNAT masih butuh trafik multi-IP nyata.
5. **Pembayaran asli**: ganti mock dengan gateway sandbox (mis. Xendit) di belakang state machine order yang ada, tanpa perlu perubahan.

---

## Lisensi

MIT
