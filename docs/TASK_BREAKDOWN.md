# Task Breakdown — Platform Ticketing (Proyek 2)

Setiap item = 1 unit kerja yang selesai dalam sekali jalan dan **cocok jadi 1 commit**.
Urutan mengikuti dependency (jangan lompat fase kecuali memang tidak bergantung).
Checklist ini pelengkap PRD.md dan migration files — bukan pengganti, baca detail teknis di sana.

## Status Terkini (Active Context)
- **Terakhir Dikerjakan:** Fase 1 — Auth & Middleware (backend) completed
- **Keputusan Teknis / Catatan:** Fase 0 complete (setup, migrations ke Supabase, ESLint, Jest). Fase 1 complete (authService, userModel, authController, middlewares authenticate/authorize, routes, 56 tests pass). API Response Convention (envelope format) ditambahkan ke AGENTS.md. Supabase pooler memerlukan username qualified (`postgres.<project_ref>`) di DATABASE_URL.
- **Task Selanjutnya:** Fase 2 — Event Management

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

- [ ] Endpoint `POST /api/events` (organizer) — create event status `draft`
- [ ] Endpoint `PUT /api/events/:id` (organizer, hanya pemilik event)
- [ ] Setup Cloudinary SDK, buat service upload gambar
- [ ] Endpoint upload gambar event (terpisah atau embedded di create/update event)
- [ ] Endpoint `GET /api/events` (public, tanpa login, hanya status `published`)
- [ ] Endpoint `GET /api/events/:id` (public, tanpa login)
- [ ] Endpoint `POST /api/events/:id/publish` (admin, ubah status ke `published`)
- [ ] Unit test: create event, update event oleh bukan pemilik (harus gagal), publish oleh non-admin (harus gagal)

---

### Fase 3 — Ticket Categories

- [ ] Endpoint `POST /api/events/:id/categories` (organizer)
- [ ] Endpoint `PUT /api/categories/:id` (organizer, hanya pemilik)
- [ ] Endpoint `GET /api/events/:id/categories` (public)
- [ ] Setelah kategori dibuat, inisialisasi `stock:category:{id}` di Redis = `quota`
- [ ] Unit test: create kategori, cek stock Redis ter-inisialisasi benar

---

## MINGGU 2 (8-14 Agustus)

### Fase 4 — Virtual Queue (Redis)

- [ ] Service `joinQueue` — `ZADD` buyer ke Sorted Set dengan timestamp
- [ ] Service `getQueuePosition` — `ZRANK` posisi buyer
- [ ] Service `dequeueBatch` — `ZPOPMIN` N buyer per interval (throttled entry)
- [ ] Scheduler/interval job di backend yang manggil `dequeueBatch` tiap X detik
- [ ] Endpoint `POST /api/queue/:categoryId/join`
- [ ] Endpoint SSE `GET /api/queue/:categoryId/stream` — push posisi antrian ke buyer
- [ ] Unit test: join queue, cek urutan FIFO dengan multiple buyer

---

### Fase 5 — Seat Lock & Checkout

- [ ] Service `lockSeat` — `SET ... EX 300 NX` di Redis
- [ ] Service `releaseSeat` — hapus lock manual (dipanggil saat bayar sukses atau batal)
- [ ] Service `decrementStock` / `incrementStock` — atomic counter Redis
- [ ] Endpoint `POST /api/checkout/:categoryId/lock` — hanya bisa diakses buyer yang sudah giliran (lolos dequeue)
- [ ] Endpoint `POST /api/orders` — buat order status `pending` di PostgreSQL setelah lock berhasil
- [ ] Unit test: lock berhasil, lock gagal karena slot sudah terkunci, lock expired otomatis balik ke stock

---

### Fase 6 — Mock Payment

- [ ] Endpoint `POST /api/orders/:id/pay` — simulasi pembayaran berhasil/gagal
- [ ] Saat pembayaran sukses: hapus seat lock, order tetap `pending` (menunggu event_date lewat)
- [ ] Saat pembayaran gagal/timeout: release lock, increment stock balik
- [ ] Unit test: pay sukses mengubah state dengan benar, pay gagal melepas lock

---

### Fase 7 — Ledger System (Inti)

- [ ] Service `createLedgerEntry` — insert baris ke `ledger_entries`, validasi debit=kredit dalam 1 transaksi
- [ ] Service `getAccountBalance` — `SUM` entries per `account_id`
- [ ] Saat order dibayar: buat entri split otomatis (kredit `organizer_pending`, kredit `platform_revenue`, sesuai persentase komisi)
- [ ] Pastikan proses create order + create ledger entries dibungkus 1 database transaction (`BEGIN...COMMIT`)
- [ ] Unit test: setiap transaksi menghasilkan entri balance (total debit = total kredit)
- [ ] Unit test: ledger_entries tidak bisa di-UPDATE dari service layer (assert desain, bukan cuma DB constraint)

---

### Fase 8 — Alur Dana (Holding Period, Refund, Override)

- [ ] Scheduled job harian: cek order yang `event_date`-nya sudah lewat → ubah status `pending` jadi `holding_period`, set `holding_until` (+7 hari)
- [ ] Scheduled job harian: cek order `holding_period` yang `holding_until` sudah lewat → ubah status jadi `released`, buat ledger entry pindah saldo `organizer_pending` → `organizer_available`
- [ ] Endpoint `POST /api/organizer/events/:id/cancel` — organizer lapor batal resmi, ubah semua order terkait jadi `refund_triggered`, buat reversing entry ke `buyer_wallet`
- [ ] Endpoint `POST /api/admin/orders/:id/override` (admin) — ubah status jadi `held`/`refunded`, hanya valid kalau order masih `holding_period`
- [ ] Unit test: skenario cancel event menghasilkan refund entry yang benar untuk semua order terkait
- [ ] Unit test: admin override ditolak kalau order sudah `released`

---

### Fase 9 — Dashboard Statistik

- [ ] Endpoint `GET /api/analytics/event/:id/overview` (organizer) — revenue, tiket terjual per kategori, status dana
- [ ] Endpoint `GET /api/analytics/platform/overview` (admin) — ringkasan lintas event
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
- [ ] Setup GitHub Actions: jalankan test (`--runInBand`) setiap push
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
