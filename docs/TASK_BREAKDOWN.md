# Task Breakdown — Platform Ticketing (Proyek 2)

Setiap item = 1 unit kerja yang selesai dalam sekali jalan dan **cocok jadi 1 commit**.
Urutan mengikuti dependency (jangan lompat fase kecuali memang tidak bergantung).
Checklist ini pelengkap PRD.md dan migration files — bukan pengganti, baca detail teknis di sana.

## Status Terkini (Active Context)
- **Terakhir Dikerjakan (sesi penutup):** hardening `x-k6-test-key` bypass (hapus total, commit `673efc5`, 1 unit test regresi, live prod via CI/CD) + follow-up docs (`deployment.md` §5a mode test, `AGENTS.md` cache exception + pelajaran k6, `TASK_BREAKDOWN` Fase 15 done) + CI `paths-ignore` untuk docs-only + rewrite README jadi portfolio job-seeker (pitch, decisions, API 29 endpoint, demo nip.io, placeholder screenshots) + audit endpoint 29/29 terpakai (nihil mati) + audit ledger pasca-beban HIJAU 5/5 (debit=kredit Rp500.000, nol order liar) + restore produksi terverifikasi + dedup `.env` basi. Repo bersih, produksi di image terbaru (cache live, hash match).
- **Task Selanjutnya:** **screenshots README** (menunggu gambar dari user: dashboard, waiting room, checkout). Sisa Fase 16 lain selesai (API docs di README, endpoint review nihil, log cleanup nihil). Item **monitoring 429** pasca-event DITUTUP sebagai validasi sintetis: default app limiter (10/10/30/600) tervalidasi via `backend/__tests__/unit/rateLimiter.defaults.test.js` (6 test - pola sah 0% 429, pola abuse diblokir); tuning nginx/CGNAT tetap butuh trafik multi-IP nyata, di luar lingkup portfolio.
- **Refactor frontend terbaru (sesi ini, setelah Fase 9/11):**
  - `style: scale down hero section components and fix linebreaks` + `style: relocate all access tape to coming up section` — penyesuaian proporsi font & card Hero section pada `Home.jsx` dan penyelarasan spesifikasi di `docs/design/design.md`.
  - `refactor: reorganize pages into role-based folders` — `frontend/src/pages/` kini dipisah per role: `auth/`, `public/`, `buyer/`, `organizer/`, `admin/`; `PlaceholderPage.jsx` (dead code) dihapus.
  - `fix: resolve sync setState lint errors in page load handlers` + `chore: lint jsx files and fix style violations` — **discovery: `npm run lint` tidak pernah memproses `.jsx`** (default ESLint 8 hanya `.js`); script diubah ke `eslint src/ --ext .js,.jsx --fix`. Semua page dengan pola `load()` handle state di-update (return data + `.then()` + cancellation guard).
  - `refactor: clean up redundant and arbitrary tailwind classes` — konversi bare value v4 (`rotate-[-1deg]`→`-rotate-1`, `aspect-[4/3]`→`aspect-4/3`, `aspect-[3/4]`→`aspect-3/4`, `max-w-[320px]`→`max-w-80`) + hapus `w-full` redundan yang menimpa `w-[calc(100%+2rem)]` di marquee waiting room.
- **Keputusan Teknis / Catatan:** pindah ke `docs/DECISIONS.md` (18 entri, format Tanggal/Konteks/Keputusan/Konsekuensi). Yang tersisa di sini hanya status kerja; aturan bisnis mengikat ada di PRD + DECISIONS.
- **Desain dan ritme yang masih berlaku di file ini:** source of truth desain `docs/design/figma-export/` (di-gitignore), `docs/design/design.md` (cream `#FFFAF0`, border tebal, Inter uppercase, marquee 20s); Tailwind v4 tanpa `tailwind.config.js` (token di `@theme`); build wajib 1x per unit frontend; `npm run lint` mencakup `.jsx`.
- **Status Fase lain:** Fase 0-12 complete, Fase 13 complete, Event Category & Admission=Lock enhancement complete, Rate limiting (app layer) enhancement complete (unit test: 265, integration: 20), **Fase 15 Stress Testing complete**, **bypass-key hardening complete**, **README portfolio rewrite complete**.
- **Task Selanjutnya:** **Fase 14 (Deployment AWS)** — setup EC2 + Docker Engine, Nginx reverse proxy di EC2 host (Opsi B: `/api/*` → `127.0.0.1:5000` backend, `/*` → `127.0.0.1:3000` frontend; hanya port 80/443 publik), deploy via GitHub Actions setelah test lolos.

## Ringkasan per Minggu

| Minggu   | Target tanggal (PRD) | Fase       | Fokus                                                          |
| -------- | -------------------- | ---------- | -------------------------------------------------------------- |
| Minggu 1 | 1-7 Agustus          | Fase 0-3   | Setup project, auth, event & ticket category                   |
| Minggu 2 | 8-14 Agustus         | Fase 4-9   | Virtual queue, seat lock, ledger, alur dana, dashboard backend |
| Minggu 3 | 15-21 Agustus        | Fase 10-14 | Frontend lengkap, testing & CI, Docker Compose, **deploy AWS ✅** |
| Minggu 4 | 22-31 Agustus        | **Fase 15-16** | **Stress testing k6**, polish, README, buffer                  |

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
- [x] Endpoint `GET /orders/:id` (auth + ownership) + Halaman resi statis (OrderDetailPage) — 3223153
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

- [x] Setup EC2 instance (t2.micro/t3.micro)
- [x] Install Docker Engine di EC2
- [x] Setup security group (expose port yang dibutuhkan saja)
- [x] Setup reverse proxy (Nginx) untuk backend + frontend *(config siap: `deploy/nginx/gigspass.conf`, tinggal pasang di server sesuai runbook)*
- [x] Deploy via `docker compose up -d` di EC2
- [x] Verifikasi CORS multi-origin & SSE tetap stabil di production
- [x] Cek ulang AWS Budgets alert masih aktif sebelum lanjut ke stress test
- [ ] *(Opsional — boleh dilewati untuk MVP)* Domain di belakang Cloudflare free tier sebagai edge DDoS/bot shield; **kalaunya diaktifkan**: security group dikunci hanya ke IP-range CF, set `trust proxy` rantai CF+Nginx, verifikasi SSE/CORS lewat proxy, dan jalankan k6 langsung ke origin (bukan lewat CF)

> **Artefak repo Fase 14 sudah siap** (`deploy/nginx/gigspass.conf`, `.github/workflows/cd.yml` hardened, runbook `docs/deployment.md`). Sisa pekerjaan = eksekusi manual AWS mengikuti runbook: EC2 → Docker → env → pasang nginx → deploy → verifikasi bertahap.

---

## MINGGU 4 (22-31 Agustus)

### Fase 15 — Stress Testing (k6, complete)

- [x] Tulis script k6 dasar: simulasi buyer join queue + checkout (`tests/load/k6-script.js`: pool 80 user, stages realistis 50→100→200→300)
- [x] Jalankan stress test skala kecil (20-50 VU) dari GitHub Actions — **terlampaui**: 2 run hingga 800 VU gabungan ke EC2 t3.micro
- [x] Verifikasi: tidak ada overselling (stok habis tepat di quota, rollback negatif bekerja)
- [x] Verifikasi: urutan antrian FIFO tetap benar di bawah beban
- [x] Verifikasi: TTL expiry melepas lock dengan benar saat banyak concurrent (cleanup + INCR stock jalan)
- [x] Naikkan skala bertahap, catat response time p95/p99 & error rate — ~80 req/s total / ~70 joins/s, error ~8–9%, p95 ~4.7s (threshold fail = ceiling infra)
- [x] Dokumentasikan hasil stress test (angka konkret) untuk README — tabel aktual 2 run + caveat isolasi skenario

---

### Fase 16 — Polish & README

- [x] Tulis README lengkap: problem statement, arsitektur, tech stack, cara setup, hasil stress test (angka aktual 2 run + verdict + ceiling analysis), API docs — **sisa**: screenshots dashboard/waiting room/checkout
- [ ] Screenshot dashboard, waiting room, checkout flow
- [ ] Review ulang semua endpoint sesuai PRD, hapus yang tidak terpakai
- [ ] Cleanup console.log / kode debug

---

## Enhancement Opsional (kalau waktu masih ada)

- [ ] Integrasi Xendit sandbox menggantikan mock payment
- [ ] Upgrade SSE ke WebSocket (hanya jika ada kebutuhan konkret 2 arah)
- [ ] Fitur Leave Queue — `POST /api/queue/:categoryId/leave`: ZREM + jalur release bila keburu pegang lock (race dengan dequeuer self-healed oleh cleanup ≤300s) + tombol frontend + unit test; leave + rejoin aman dari gaming (seq monotonik)
- [ ] Optimasi SSE waiting room (broadcast per-tick) — ganti polling 2 detik per koneksi dengan registry in-process per kategori yang melacak posisi tiap koneksi secara lokal; dequeuer mengumumkan lewat dua metode: `applyAdmission` (pop FIFO → yang keluar dapat `granted` personal langsung dari hasil dequeue, sisanya cukup dikurangi K) dan `applyLeave` (keluar dari tengah antrian → yang di belakang leaver −1, di depannya tetap). Posisi awal diambil sekali saat connect; auto-reconnect frontend = resink alami. Invarian: setiap mutasi antrian wajib mengumumkan lewat registry. Nol query PG & Redis di steady-state; format kabel SSE tak berubah (frontend tak tersentuh). Menyerap item lama "fix deteksi granted" — granted kini dikirim langsung dari daftar pop, bukan ditebak dari posisi null.
- [ ] Deteksi & siarkan true sell-out — cek O(1) sekali per tick di dequeuer: `stock == 0 && ZCARD(lockexpiry) == 0 && antrian tidak kosong` (= semua tiket lunas, tak ada lock menggantung; identitas `stock + lock aktif + lunas = quota` terjaga karena cleanup/release selalu INCR bersamaan hilangnya lock, dan confirmSlot menukar pasangan lock↔lunas tanpa menyentuh stock) → siarkan event `soldout` ke ruang tunggu → layar terminal di WaitingRoomPage + tutup stream. Selama masih ada lock kondisi tak pernah true — ruangan penuh tetap berarti menunggu daur ulang slot via TTL/cleanup, bukan habis. Sekalian: hapus panel `soldout` mayat di CheckoutPage (pemicu 409 out-of-stock sudah tak terjangkau sejak Admission=Lock). Pendukung fase beku pra-sellout: pesan status di WaitingRoomPage saat posisi diam karena stok nol namun lock masih menggantung — mis. "Semua tiket sedang dipegang pembayar; slot baru terbuka jika ada pembayaran yang gagal" — angka diam berubah dari kesan error menjadi informasi jujur.
- [ ] Hook `MAX_PENDING_LOCKS` — cap concurrent pending payment, wajib hidup saat integrasi payment gateway nyata (Xendit)
- [x] Rate limiting aplikasi (`express-rate-limit`, selesai) — login 10/menit/IP hitung-gagal-saja (`skipSuccessfulRequests`: sukses tak makan jatah → aman CGNAT, brute force kegergaji), register 10/menit/IP hitung-semua (sukses = akun baru = komoditas bot farm), join 30/menit/per-user (dipasang setelah authenticate → kebal NAT), global 600/menit/IP kecuali path `*/stream` (anti reconnect-storm); respons 429 ber-envelope; `TRUST_PROXY` env-driven untuk rantai proxy produksi; default unlimited saat NODE_ENV=test agar suite lama tak tersapu (7 unit test baru, total 253)
- [x] Rate limiting nginx `limit_req` sebagai benteng luar (config selesai & ter-commit di `deploy/nginx/gigspass.conf`; aktivasi + verifikasi menyusul saat deploy Fase 14) — **zona tunggal** general ~600r/m per IP (+burst) tanpa zona auth khusus — presisi brute-force milik app limiter (`skipSuccessfulRequests`), nginx murni tembok volumetrik agar CGNAT tak tersapu; `limit_req_status 429`. Lapisan lanjutan anti-abuser yang *selalu berhasil* (stuffing kredensial valid / bot registrasi) tetap dicatat: Turnstile atau honeypot di `/register`, cek password bocor HaveIBeenPwned saat daftar, deteksi velocity akun-unik-per-IP — dibangun hanya saat sudah ada user & pembayaran nyata
- [x] Hardening `x-k6-test-key` bypass (temuan Fase 15, selesai) — header `stress-test-secret` di `rateLimiter.js` mem-bypass SEMUA limiter dan secret-nya hardcoded di repo publik. Keputusan: **hapus total** (commit `673efc5`) + 1 unit test regresi (header lama tetap kena 429) + bersih 4 header di `k6-script.js`. Prosedur stress test kini wajib via `.env` 99999 + nginx no-limit (lihat `docs/deployment.md` §5a).
- [ ] Ketahanan auth saat flash crowd — bcrypt ~65–300 ms CPU menjadikan login endpoint terberat di aplikasi (~3–15 login/detik per instance); tangga mitigasi: session/JWT panjang agar surge menyusut ke user baru saja → replika backend horizontal di belakang nginx upstream (login stateless, mudah dikalikan) → worker-thread untuk hashing → opsi roadmap jauh: waiting room anonim ala Ticketmaster sebelum login. Prinsip: limiter menjaga dari yang abnormal, kapasitas melayani yang normal — ukuran limiter tidak boleh lebih ketat dari demand sah
- [ ] Adaptive pass-through + estimasi tunggu (pola industri Cloudflare Waiting Room/Queue-it/AWS VWR) — saat laju kedatangan rendah & antrian kosong: buyer lolos langsung ke checkout tanpa halaman waiting (alasan utamanya bukan kecepatan, melainkan ruang tunggu hanya tampil saat ia berarti); saat serbuan: antrean aktif otomatis. Sinyal deteksi = LAJU kedatangan vs kapasitas layan, BUKAN total customer vs quota (4.999 klik bersamaan tetap perang meski < kuota) + hysteresis anti-flapping; bypass inline wajib atomicity (Lua script) agar tak race dual-path dengan dequeuer. Pendamping UX: estimasi waktu tunggu dari riwayat throughput (Cloudflare menampilkan ini; kita baru punya angka posisi), plus catatan opsi pre-queue acak/lotre ala Ticketmaster sebagai senjata anti-bot. Trigger: produksi nyata dengan event rush sungguhan. Konteks pembanding: CF membatasi concurrent sessions aktif (pintu berputar), sistem kita membatasi stok inventori (satu arah) — kelas masalah berbeda, FIFO absolut tetap identitas kita
- [ ] Known-limitation Redis re-init/rekonsiliasi — counter `stock:` dan antrian hidup di Redis; bila Upstash ter-flush, order tetap ada di Postgres tetapi stok/antrian hilang → siapkan prosedur re-init (`stock = quota − order aktif/lunas` dihitung dari DB) atau job rekonsiliasi berkala; untuk MVP cukup didokumentasikan sebagai runbook pemulihan, bukan kode baru
