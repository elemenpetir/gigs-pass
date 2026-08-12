# Task Breakdown — Platform Ticketing (Proyek 2)

Setiap item = 1 unit kerja yang selesai dalam sekali jalan dan **cocok jadi 1 commit**.
Urutan mengikuti dependency (jangan lompat fase kecuali memang tidak bergantung).
Checklist ini pelengkap PRD.md dan migration files — bukan pengganti, baca detail teknis di sana.

## Status Terkini (Active Context)
- **Terakhir Dikerjakan:** Fase 7 & 8 complete (Ledger System + Alur Dana), dan **Fase 9 backend complete** (2 endpoint analytics). Commit terakhir: `test: add unit test for analytics platform overview`. 8 commit baru: ledger service + test, holding period/release job, cancel→refund reversing + test, admin override + test, merge status refund (refactor+test), analytics event overview (feat+test), analytics platform overview (feat+test).
- **Keputusan Teknis / Catatan:** Fase 1-8 complete (auth, event CRUD, kategori, queue, checkout, mock payment, ledger, alur dana). Unit test mock sekarang **232**, integration 20, total 252. `db.js` pakai `DATABASE_SSL`. Envelope format & Event Status Flow (limited lifecycle) ada di AGENTS.md.
- **Status refund (refactor, barusan):** `refund_triggered` DIHAPUS — semua refund memakai satu status `refunded` + kolom `orders.refund_reason` (`event_cancelled` | `admin_override`). Migration `1722800004000_create-orders.js` **di-edit in-place** (bukan file baru) karena masih MVP tanpa data penting; dev & test DB di-reset (`down count 999` → `up` — catatan: runner v9 abaikan `to: 0`, harus pakai `count`). Dua jalur refund tetap beda flow tapi bedanya disimpan di data: cancel pre-event (bulk, holding_until NULL) vs admin override post-event (per order, holding_until terisi).
- **Fase 5 design decision:** **General admission** — tidak ada `seat_no`/kursi bernomor; "slot" = 1 unit kuota. Lock per buyer (`lock:category:{id}:buyer:{uid}`, EX 300 NX), bukan per seat. Granted marker (`granted:category:{id}:buyer:{uid}`, EX 300) di-set dequeueBatch sebagai bukti lolos antrian. One-shot admission: buyer gagal bayar harus join antrian lagi. Status order dipecah: `awaiting_payment` (saat lock) → `pending` (dibayar) → dst.; `expired` untuk yang gagal bayar; `paid_at` (nullable) mencatat waktu bayar sukses. Bayar sukses → `confirmSlot` (hapus lock, stock TETAP turun); gagal/TTL → `releaseSlot` (hapus lock + `INCR stock`).
- **Fase 6 design decision:** lock yang ditinggalkan (buyer lock lalu pergi tanpa bayar) dipulihkan lewat cleanup yang di-fold ke `queueDequeuer` — TTL Redis menghapus key lock tapi tidak otomatis `INCR stock`, jadi perlu tracker `lockexpiry:category:{id}` (Sorted Set, score = epoch expiry) yang di-scan di awal tiap `processQueueForCategory` (interval 5s, sebelum `dequeueBatch` baca stock) → `DEL lock` + `INCR stock` + order `awaiting_payment` di-mark `expired`. `lockCleaner.js` dihapus (tidak ada job terpisah); `queueDequeuer.run()` punya anti-overlap guard. Pay mock `POST /api/orders/:id/pay` body `{ success: true|false }` — sukses → `confirmSlot` + order `pending` + `paid_at`; gagal → `releaseSlot` + order `expired`.
- **Fase 9 design decision:** paid statuses untuk revenue hanya 4 (`pending`, `holding_period`, `released`, `held`). `refunded` dihitung TERPISAH (`refundedAmount`), `netRevenue = revenue − refundedAmount`. `held` tetap masuk revenue (dana sudah masuk, hanya ditahan) tapi di-breakdown eksplisit (`heldAmount`/`heldCount`) supaya dana sengketa transparan. Fund status organizer diambil dari balance ledger account (`organizer_pending`/`organizer_available`), bukan SUM orders. Endpoint: `GET /api/analytics/event/:id/overview` (organizer, validasi owner + 403) & `GET /api/analytics/platform/overview` (admin, 403 non-admin).
- **Task Selanjutnya:** Frontend Fase 9 (dashboard organizer + admin) — sengaja ditunda, digarap bersama Fase 10-11 setelah infra router/auth/API client dibangun. Urutan berikutnya: Fase 10 Frontend Buyer Flow.

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
- [ ] Frontend: halaman dashboard organizer (chart sederhana, Recharts)
- [ ] Frontend: halaman dashboard admin

---

## MINGGU 3 (15-21 Agustus)

### Fase 10 — Frontend Buyer Flow

- [ ] Halaman list event (public)
- [ ] Halaman detail event (gambar + deskripsi ala artikel)
- [ ] Halaman waiting room (koneksi SSE, tampilkan posisi antrian real-time)
- [ ] Halaman checkout (timer countdown sesuai TTL lock)
- [ ] Halaman riwayat order buyer

---

### Fase 11 — Frontend Organizer & Admin Flow

- [ ] Form create/edit event (termasuk upload gambar)
- [ ] Form create/edit kategori tiket
- [ ] Halaman daftar order & status dana per event
- [ ] Halaman admin: approve event
- [ ] Halaman admin: manual override order

---

### Fase 12 — Unit Test Lanjutan & CI

- [ ] Lengkapi test coverage untuk semua service kritikal (ledger, queue, lock)
- [ ] Setup GitHub Actions: jalankan `npm test` **dan** `npm run test:integration` (`--runInBand`) setiap push — pakai `services: postgres:latest` untuk integration test (tanpa Docker lokal)
- [ ] Matikan auto-deploy, deploy hanya lewat GitHub Actions setelah test lolos (pola sama seperti AssetShield)

---

### Fase 13 — Docker Compose

- [ ] Dockerfile backend
- [ ] Dockerfile frontend
- [ ] `docker-compose.yml` — backend + frontend (Redis & PostgreSQL tetap eksternal di Upstash/Supabase, tidak perlu container sendiri)
- [ ] Pastikan env vars (termasuk `ARG`/`ENV` untuk Vite) ter-inject dengan benar ke image
- [ ] Test `docker compose up` jalan lokal end-to-end

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
