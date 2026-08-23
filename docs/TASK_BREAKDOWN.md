# Task Breakdown — Platform Ticketing (Proyek 2)

Setiap item = 1 unit kerja yang selesai dalam sekali jalan dan **cocok jadi 1 commit**.
Urutan mengikuti dependency (jangan lompat fase kecuali memang tidak bergantung).
Checklist ini pelengkap PRD.md dan migration files — bukan pengganti, baca detail teknis di sana.

## Status Terkini (Active Context)
- **Terakhir Dikerjakan:** **Fase 13 (Docker Compose) complete** — `backend/Dockerfile` (node:20-alpine, `npm ci --omit=dev`), `frontend/Dockerfile` (multi-stage Vite build → nginx:alpine serve static + SPA routing), `docker-compose.yml` di root (backend bind `127.0.0.1:5000`, frontend `127.0.0.1:3000`, healthcheck `/api/health`, frontend wait backend healthy). Env injection terbukti (DB connect sukses via compose `env_file`; `.env` di-exclude dari image via `.dockerignore`). Test lokal via Docker WSL: build OK, kedua container healthy, health check & Nginx serve 200. Full flow frontend→backend menunggu Nginx reverse proxy EC2 host (Fase 14, arsitektur Opsi B — single port publik).
- **Refactor frontend terbaru (sesi ini, setelah Fase 9/11):**
  - `style: scale down hero section components and fix linebreaks` + `style: relocate all access tape to coming up section` — penyesuaian proporsi font & card Hero section pada `Home.jsx` dan penyelarasan spesifikasi di `docs/design/design.md`.
  - `refactor: reorganize pages into role-based folders` — `frontend/src/pages/` kini dipisah per role: `auth/`, `public/`, `buyer/`, `organizer/`, `admin/`; `PlaceholderPage.jsx` (dead code) dihapus.
  - `fix: resolve sync setState lint errors in page load handlers` + `chore: lint jsx files and fix style violations` — **discovery: `npm run lint` tidak pernah memproses `.jsx`** (default ESLint 8 hanya `.js`); script diubah ke `eslint src/ --ext .js,.jsx --fix`. Semua page dengan pola `load()` handle state di-update (return data + `.then()` + cancellation guard).
  - `refactor: clean up redundant and arbitrary tailwind classes` — konversi bare value v4 (`rotate-[-1deg]`→`-rotate-1`, `aspect-[4/3]`→`aspect-4/3`, `aspect-[3/4]`→`aspect-3/4`, `max-w-[320px]`→`max-w-80`) + hapus `w-full` redundan yang menimpa `w-[calc(100%+2rem)]` di marquee waiting room.
- **Keputusan Teknis / Catatan:**
  - **Desain final = Neo-Brutalism + anti-design + festival** — source of truth `docs/design/figma-export/` (hasil Figma Make, di-gitignore). `docs/design/design.md` di-rewrite penuh: cream `#FFFAF0` + hitam `#0A0A0A`, border tebal 2/3/4px, hard offset shadow, radius persegi, Inter 400–900 uppercase, marquee 20s, `brut-button`/`brut-card-hover`, pita diagonal, aturan 70/30.
  - **Tailwind v4:** `tailwind.config.js` DIHAPUS (v4 tidak auto-detect config legacy — butuh `@config`; semua token hidup di `@theme` `src/index.css`). `max-w-[1280px]` → `max-w-7xl` (=80rem). `vite.config.js` pakai `import.meta.dirname` (hilangkan warning Vite).
  - **Frontend buyer flow:** waiting room pakai `@microsoft/fetch-event-source` (Bearer header, auto-reconnect, abort saat granted). Checkout: lock 300s + countdown (denyut <60s), pay mock `{success}`, one-shot admission. Login redirect pakai `location.state.from`. `auth.jsx` pakai lazy-init `useState(() => Boolean(getToken()))` (tanpa setState sinkron dalam effect).
  - **Ritme verifikasi frontend (AGENTS.md):** build wajib 1x di titik commit per unit kerja; lint di sela perubahan besar; docs-only tidak perlu build.
  - **Fase 9 design decision (backend analytics):** paid statuses untuk revenue hanya 4 (`pending`, `holding_period`, `released`, `held`). `refunded` dihitung TERPISAH (`refundedAmount`), `netRevenue = revenue − refundedAmount`. `held` tetap masuk revenue tapi di-breakdown eksplisit (`heldAmount`/`heldCount`). Fund status organizer diambil dari balance ledger account (`organizer_pending`/`organizer_available`), bukan SUM orders. Endpoint: `GET /api/analytics/event/:id/overview` (organizer, owner check) & `GET /api/analytics/platform/overview` (admin).
  - **Event Category (enhancement, selesai):** kolom `events.category` enum NOT NULL (`music`/`festival`/`concert`/`comedy`/`art`/`culture`) + CHECK di migration `create-events`. List slug di backend `src/config/constants.js` (`EVENT_CATEGORIES`) + mirror frontend `frontend/src/lib/categories.js` (`EVENT_CATEGORIES` + `categoryLabel`). `GET /api/events` kini dukung `?category=` dan return `min_price` (LEFT JOIN `ticket_categories` + `MIN(price)` + `GROUP BY e.id`) — hapus N+1 harga di Home/EventsPage. Frontend: select kategori di form event, halaman `/events` filter client-side, navbar jadi Discover/Events (Categories dihapus), BROWSE VIBES → `/events?category=...`.
  - **Queue: Admission = Lock (selesai):** hapus marker `granted:*` — buyer yang diadmit (dequeue) langsung `SET lock EX 300 NX` + `DECR stock` (rollback `INCR`+`DEL` bila negatif) + `ZADD lockexpiry`. `POST /api/checkout/:id/lock` jadi verifikasi reservasi (`getReservation` + `PTTL`). Satu grant = satu kesempatan; gagal bayar/TTL → antri ulang (one-shot ketat, loophole re-lock tertutup). Trade-off UX: hitung mundur mulai dari admission, bukan klik checkout — frontend auto-redirect saat `granted`, nyaris tak terasa. Circular require lockService↔queueService ikut hilang.
  - **CTA Entry Ticket:** tombol kategori tiket di `EventDetailPage` direlabel dari `JOIN QUEUE` → `GET TICKETS` — purchase-intent ala Ticketmaster/Tokopedia agar familiar, tanpa menjanjikan checkout seketika (ruang tunggu tetap transparan di layar berikutnya, selaras vocabulary design.md "BUY"/"TICKETS"). Alur join → waiting room → auto-redirect saat `granted` tidak berubah. `REJOIN QUEUE →` di CheckoutPage (state gagal/expired) dipertahankan demi kejujuran konsekuensi one-shot.
- **Status Fase lain:** Fase 0-12 complete, Fase 13 complete (unit test: 246, integration: 20), Event Category & Admission=Lock enhancement complete.
- **Task Selanjutnya:** **Fase 14 (Deployment AWS)** — setup EC2 + Docker Engine, Nginx reverse proxy di EC2 host (Opsi B: `/api/*` → `127.0.0.1:5000` backend, `/*` → `127.0.0.1:3000` frontend; hanya port 80/443 publik), deploy via GitHub Actions setelah test lolos.
- **Watch-list (belum diputuskan):** rundingkan interval dequeue 5 detik (opsi: perbesar batch `QUEUE_BATCH_SIZE`, persingkat `QUEUE_DEQUEUE_INTERVAL_MS`, atau admit stock-driven) — hasil diskusi sesi refactor Admission=Lock.

## Ringkasan per Minggu

| Minggu   | Target tanggal (PRD) | Fase       | Fokus                                                          |
| -------- | -------------------- | ---------- | -------------------------------------------------------------- |
| Minggu 1 | 1-7 Agustus          | Fase 0-3   | Setup project, auth, event & ticket category                   |
| Minggu 2 | 8-14 Agustus         | Fase 4-9   | Virtual queue, seat lock, ledger, alur dana, dashboard backend |
| Minggu 3 | 15-21 Agustus        | Fase 10-14 | Frontend lengkap, testing & CI, Docker Compose, deploy AWS     |
| Minggu 4 | 22-31 Agustus        | Fase 15-16 | Stress testing k6, polish, README, buffer                      |

> Catatan: pembagian ini asumsi mulai coding dari 1 Agustus sesuai PRD. Kalau start aktualmu mundur, geser tanggalnya secara proporsional — urutan fase tetap sama, cuma jendela waktunya yang menyesuaikan.

---

## MINGGU 1 (1-7 Agustus)

### Fase 0 — Project Setup

- [x] Init monorepo: folder `backend/` dan `frontend/`, root `README.md` kosong
- [x] Setup `backend/`: `npm init`, install Express, pg, dotenv, jsonwebtoken, bcrypt
- [x] Setup struktur folder backend (MVC/service layer): `src/routes/`, `src/controllers/`, `src/services/`, `src/models/`, `src/middlewares/`, `src/config/`, `src/jobs/`, `src/utils/`
- [x] Setup koneksi PostgreSQL dengan connection pool (`pg.Pool`), baca `DATABASE_URL` dari `.env`
- [x] Setup `node-pg-migrate`, copy migration files yang sudah dibuat ke `backend/migrations/`
- [x] Jalankan migration ke database Supabase/Neon, verifikasi semua tabel & seed platform_revenue terbuat
- [x] Setup koneksi Redis (Upstash) — buat helper/client terpisah (`src/config/redis.js`)
- [x] Setup `.env.example` (tanpa value asli) + pastikan `.env` masuk `.gitignore`
- [x] Setup Express app skeleton: health check endpoint `GET /api/health`
- [x] Setup `frontend/`: Vite + React, Tailwind CSS, shadcn/ui dengan custom pop design components
- [x] Setup ESLint/Prettier dasar (opsional, kalau mau konsisten dari awal)

---

### Fase 1 — Auth & Middleware

- [x] Buat service `hashPassword`/`comparePassword` (bcrypt)
- [x] Endpoint `POST /api/auth/register` — buyer & organizer, validasi email unik
- [x] Endpoint `POST /api/auth/login` — return JWT
- [x] Middleware `authenticate` — verifikasi JWT, attach `req.user`
- [x] Middleware `authorize(roles)` — cek role sesuai endpoint
- [x] Endpoint `GET /api/auth/me`
- [x] Unit test: register, login (sukses & gagal), akses endpoint protected tanpa token

---

### Fase 2 — Event Management

- [x] Update migration `1722800002000_create-events.js` — hapus `pending_approval`, tambah `suspended` status
- [x] Endpoint `POST /api/events` (organizer) — create event status `draft`
- [x] Endpoint `PUT /api/events/:id` (organizer, hanya pemilik)
- [x] Setup Cloudinary SDK, buat service upload gambar
- [x] Endpoint `POST /api/events/:id/image` (organizer, hanya pemilik) — upload gambar
- [ ] Endpoint `PUT /api/events/:id/unpublish` (organizer, hanya pemilik) — optional, jika ingin drawer pulang dari published ke draft (tidak wajib MVP)
- [x] Endpoint `PUT /api/events/:id/publish` (organizer, hanya pemilik — status `draft` to `published`)
- [x] Endpoint `PUT /api/events/:id/suspend` (admin) — status `published` to `suspended`, hanya jika belum digelar
- [x] Endpoint `PUT /api/events/:id/cancel` (organizer/admin) — status `published`/`suspended` to `cancelled`, hanya jika belum digelar, trigger refund di orders
- [x] Endpoint `GET /api/events` (public, tanpa login, hanya status `published`)
- [x] Endpoint `GET /api/events/:id` (public, tanpa login)
- [x] Unit test: create event, update oleh bukan pemilik (gagal) [selesai]; publish, suspend/cancel saat sudah digelar (gagal) [selesai bersama endpoint #6-8]

---

### Fase 3 — Ticket Categories

- [x] Endpoint `POST /api/events/:id/categories` (organizer)
- [x] Endpoint `PUT /api/categories/:id` (organizer, hanya pemilik)
- [x] Endpoint `GET /api/events/:id/categories` (public)
- [x] Setelah kategori dibuat, inisialisasi `stock:category:{id}` di Redis = `quota`
- [x] Unit test: create kategori, cek stock Redis ter-inisialisasi benar

---

## MINGGU 2 (8-14 Agustus)

### Fase 4 — Virtual Queue (Redis)

- [x] Service `joinQueue` — `ZADD` buyer ke Sorted Set dengan timestamp
- [x] Service `getQueuePosition` — `ZRANK` posisi buyer
- [x] Service `dequeueBatch` — `ZPOPMIN` N buyer per interval (throttled entry)
- [x] Scheduler/interval job di backend yang manggil `dequeueBatch` tiap X detik
- [x] Endpoint `POST /api/queue/:categoryId/join`
- [x] Endpoint SSE `GET /api/queue/:categoryId/stream` — push posisi antrian ke buyer
- [x] Unit test: join queue, cek urutan FIFO dengan multiple buyer

---

### Fase 5 — Seat Lock & Checkout (General Admission)

- [x] Migration `orders.status`: tambah `awaiting_payment` & `expired`, kolom `paid_at` nullable — pecah ambiguitas `pending` (belum vs sudah bayar)
- [x] Granted marker saat dequeue — `dequeueBatch` menandai buyer yang di-admit dengan `granted:category:{id}:buyer:{uid}` (SET EX 300) sebagai bukti lolos antrian
- [x] Service `reserveSlot` — cek `granted` → `SET lock:category:{id}:buyer:{uid} EX 300 NX` + `DECR stock` (general admission, per buyer bukan per seat)
- [x] Service `confirmSlot` — hapus lock saat bayar sukses (stock TETAP berkurang); `releaseSlot` — hapus lock + `INCR stock` saat batal/gagal/TTL
- [x] Endpoint `POST /api/checkout/:categoryId/lock` — hanya buyer yang lolos dequeue (granted marker) & belum punya lock
- [x] Endpoint `POST /api/orders` — buat order status `awaiting_payment` di PostgreSQL setelah lock berhasil (validasi lock aktif + anti-duplikat)
- [x] Unit test: reserve sukses, reserve gagal (belum granted / double reserve / stock habis), confirm tanpa INCR, release balik ke stock, create order butuh lock

---

### Fase 6 — Mock Payment

- [x] Endpoint `POST /api/orders/:id/pay` — simulasi pembayaran berhasil/gagal (body `{ success: true|false }`)
- [x] Saat pembayaran sukses: `confirmSlot` (hapus lock, stock TETAP turun), order → `pending` (menunggu event_date lewat), set `paid_at`
- [x] Saat pembayaran gagal/timeout: `releaseSlot` (release lock + increment stock balik), order → `expired`
- [x] Lock cleanup — lock yang ditinggalkan (buyer tidak bayar / tidak create order) dipulihkan: `lockService.cleanupExpiredLocks` di-fold ke awal `processQueueForCategory` (queueDequeuer tiap 5s, sebelum dequeueBatch) → `ZRANGEBYSCORE lockexpiry:category:{id}` → `DEL lock` + `INCR stock` + order `awaiting_payment` → `expired`
- [x] Unit test: pay sukses mengubah state dengan benar, pay gagal melepas lock, pay saat lock expired → 409, lock cleanup (di lockService + urutan cleanup-sebelum-dequeue + anti-overlap di queueDequeuer) — 191 total

---

### Fase 7 — Ledger System (Inti)

- [x] Service `createLedgerEntry` — insert baris ke `ledger_entries`, validasi debit=kredit dalam 1 transaksi
- [x] Service `getAccountBalance` — `SUM` entries per `account_id`
- [x] Saat order dibayar: buat entri split otomatis (kredit `organizer_pending`, kredit `platform_revenue`, sesuai persentase komisi — `PLATFORM_COMMISSION_PERCENT` default 10%)
- [x] Kolom `orders.amount` (snapshot dari `ticket_categories.price` saat create order) + `payOrder` sukses dibungkus 1 database transaction (`withTransaction`: markPaid + split ledger)
- [x] Unit test: setiap transaksi menghasilkan entri balance (total debit = total kredit)
- [x] Unit test: ledger_entries tidak bisa di-UPDATE dari service layer (assert desain, bukan cuma DB constraint) — 203 total

---

### Fase 8 — Alur Dana (Holding Period, Refund, Override)

- [x] Scheduled job harian (`orderLifecycle`): cek order yang `event_date`-nya sudah lewat → ubah status `pending` jadi `holding_period`, set `holding_until` (+7 hari, konstanta `HOLDING_PERIOD_DAYS`)
- [x] Scheduled job harian: cek order `holding_period` yang `holding_until` sudah lewat → ubah status jadi `released`, buat ledger entry pindah saldo `organizer_pending` → `organizer_available` (`recordRelease`)
- [x] Endpoint `PUT /api/events/:id/cancel` (organizer/admin) — satu transaksi penuh: event → `cancelled`, order dibayar → `refunded` (refund_reason='event_cancelled'), reversing entry ke `buyer_wallet` (`recordRefund`); order belum-bayar TIDAK di-refund
- [x] Endpoint `POST /api/admin/orders/:id/override` (admin) — ubah status jadi `held`/`refunded`, hanya valid kalau order masih `holding_period`; `refunded` ikut membuat reversing entry
- [x] Unit test: skenario cancel event menghasilkan refund entry yang benar untuk semua order terkait (hanya yang dibayar)
- [x] Unit test: admin override ditolak kalau order sudah `released` — 220 total

---

### Fase 9 — Dashboard Statistik

- [x] Endpoint `GET /api/analytics/event/:id/overview` (organizer) — revenue, tiket terjual per kategori, status dana
- [x] Endpoint `GET /api/analytics/platform/overview` (admin) — ringkasan lintas event
- [x] Frontend: halaman dashboard organizer (chart sederhana, Recharts)
- [x] Frontend: halaman dashboard admin

---

## MINGGU 3 (15-21 Agustus)

### Fase 10 — Frontend Buyer Flow (complete)

- [x] Halaman list event (public) — port dari desain Figma home/discover, data `GET /api/events` + harga min per kategori
- [x] Halaman detail event (gambar + deskripsi ala artikel) — poster brutal, daftar kategori tiket, CTA join queue
- [x] Halaman waiting room (koneksi SSE, tampilkan posisi antrian real-time) — `@microsoft/fetch-event-source`, Bearer header, event `position`/`granted`
- [x] Halaman checkout (timer countdown sesuai TTL lock) — lock 300s, create order, pay mock, countdown denyut <60s
- [x] Halaman riwayat order buyer — endpoint baru `GET /api/orders`, badge status + alasan refund

---

### Fase 11 — Frontend Organizer & Admin Flow

- [x] Form create/edit event (termasuk upload gambar)
- [x] Form create/edit kategori tiket
- [x] Halaman daftar order & status dana per event
- [x] Halaman admin: approve event
- [x] Halaman admin: manual override order

---

### Fase 12 — Unit Test Lanjutan & CI

- [x] Lengkapi test coverage untuk semua service kritikal (ledger, queue, lock)
- [x] Setup GitHub Actions: jalankan `npm test` **dan** `npm run test:integration` (`--runInBand`) setiap push — pakai `services: postgres:latest` untuk integration test (tanpa Docker lokal)
- [x] Matikan auto-deploy, deploy hanya lewat GitHub Actions setelah test lolos (pola sama seperti AssetShield)

---

### Enhancement — Event Category (genre/vibe, selesai)

- [x] Migration: kolom `events.category` (enum `music`/`festival`/`concert`/`comedy`/`art`/`culture`, NOT NULL + CHECK) — edit langsung file `1722800002000_create-events.js` (belum ada data penting, lalu `migrate down/up`)
- [x] Backend: validasi category di create/update (`EVENT_CATEGORIES` di `src/config/constants.js`), filter `?category=` di `GET /api/events`, unit test category
- [x] Backend: `GET /api/events` return `min_price` per event (LEFT JOIN `ticket_categories` + `MIN(price)` + `GROUP BY e.id`) — hilangkan N+1 harga di frontend
- [x] Frontend: select kategori di form event (`frontend/src/lib/categories.js`), halaman `/events` filter client-side + chip, navbar jadi Discover/Events, BROWSE VIBES → `/events?category=...`

---

### Enhancement — Queue: Admission = Lock (merge granted → lock, selesai)

- [x] Hapus marker `granted:*` & `GRANTED_TTL_SECONDS` — `dequeueBatch` langsung `SET lock EX 300 NX` + `DECR stock` (+ rollback bila negatif) + `ZADD lockexpiry` (admission = lock, no over-admission, one-shot ketat)
- [x] `/api/checkout/:categoryId/lock` jadi verifikasi reservasi (`getReservation` + `PTTL` sisa waktu); hapus `isGranted`/`reserveSlot` (circular require lockService↔queueService ikut hilang)
- [x] Unit test rework dequeue/reservation (246 pass) + docs sinkron (AGENTS/PRD/TASK_BREAKDOWN)

---

### Fase 13 — Docker Compose

- [x] Dockerfile backend
- [x] Dockerfile frontend
- [x] `docker-compose.yml` — backend + frontend (Redis & PostgreSQL tetap eksternal di Upstash/Supabase, tidak perlu container sendiri)
- [x] Pastikan env vars (termasuk `ARG`/`ENV` untuk Vite) ter-inject dengan benar ke image
- [x] Test `docker compose up` jalan lokal end-to-end

---

### Fase 14 — Deployment AWS

- [ ] Setup EC2 instance (t2.micro/t3.micro)
- [ ] Install Docker Engine di EC2
- [ ] Setup security group (expose port yang dibutuhkan saja)
- [ ] Setup reverse proxy (Nginx) untuk backend + frontend
- [ ] Deploy via `docker compose up -d` di EC2
- [ ] Verifikasi CORS multi-origin & SSE tetap stabil di production
- [ ] Cek ulang AWS Budgets alert masih aktif sebelum lanjut ke stress test

---

## MINGGU 4 (22-31 Agustus)

### Fase 15 — Stress Testing (k6)

- [ ] Tulis script k6 dasar: simulasi buyer join queue + checkout
- [ ] Jalankan stress test skala kecil (20-50 VU) dari GitHub Actions
- [ ] Verifikasi: tidak ada overselling (jumlah order sukses = kuota)
- [ ] Verifikasi: urutan antrian FIFO tetap benar di bawah beban
- [ ] Verifikasi: TTL expiry melepas lock dengan benar saat banyak concurrent
- [ ] Naikkan skala bertahap, catat response time p95/p99 & error rate
- [ ] Dokumentasikan hasil stress test (angka konkret) untuk README

---

### Fase 16 — Polish & README

- [ ] Tulis README lengkap: problem statement, arsitektur, tech stack, cara setup, hasil stress test, API docs
- [ ] Screenshot dashboard, waiting room, checkout flow
- [ ] Review ulang semua endpoint sesuai PRD, hapus yang tidak terpakai
- [ ] Cleanup console.log / kode debug

---

## Enhancement Opsional (kalau waktu masih ada)

- [ ] Integrasi Xendit sandbox menggantikan mock payment
- [ ] Upgrade SSE ke WebSocket (hanya jika ada kebutuhan konkret 2 arah)
