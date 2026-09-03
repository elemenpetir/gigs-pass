# Task Breakdown — Platform Ticketing (Proyek 2)

Setiap item = 1 unit kerja yang selesai dalam sekali jalan dan **cocok jadi 1 commit**.
Urutan mengikuti dependency (jangan lompat fase kecuali memang tidak bergantung).
Checklist ini pelengkap PRD.md dan migration files — bukan pengganti, baca detail teknis di sana.

## Status Terkini (Active Context)
- **Terakhir Dikerjakan:** **Fase 15 Stress Testing k6 complete** — EC2 t3.micro, kategori stress-test quota 5000, 2 run gabungan (join_ramp + sse_ramp, 800 VU): ~80 req/s total / ~70 joins sukses/detik dengan error ~8–9%, p95 ~4.7s (threshold tidak tercapai — ceiling = infra, bukan desain). Terbukti: no oversell (stok tepat habis), FIFO holds, TTL cleanup jalan, server degrade graceful (500, bukan crash). Caveat: isolasi skenario k6 gagal (lihat AGENTS.md). Artefak: `tests/load/k6-script.js` (stages realistis), category cache in-memory TTL 60s (`queueService.js`, live prod), hasil aktual di README.
- **Task Selanjutnya:** **Fase 16 sisa** — screenshots, API docs, review endpoint tak terpakai, cleanup log/debug. Lalu opsional: hardening `x-k6-test-key` bypass (lihat catatan keamanan di bawah), monitoring 429 untuk tuning limiter pasca-event.
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
  - **Interval dequeue = 5 detik (final):** pertahankan throttled entry batch 50 / interval 5s — throughput ~600 admit/menit/kategori jauh di atas skala target; cleanup lock jalan sebelum dequeue tiap tick sehingga stok segar kembali ≤5s setelah lock expire; FIFO tetap ketat via score `INCR queue:seq`; beban Redis trivial untuk t2.micro. Keduanya env-overridable (`QUEUE_BATCH_SIZE`, `QUEUE_DEQUEUE_INTERVAL_MS`) — kalau k6 Fase 15 menunjukkan tekanan, tuning cukup ubah config. Admit stock-driven ditolak untuk MVP (butuh pub/sub trigger, thundering herd saat rush awal).
  - **Model beban queue (design review + Fase 15 terukur):** ruang checkout itu pasif — buyer yang menunggu bayar tidak memegang koneksi/timer server (biaya hanya 1 row `awaiting_payment` + key Redis); laju admisi ter-cap 10 buyer/detik oleh valve batch 50/5s apa pun ukuran stok (stok besar = durasi rush lebih panjang, bukan hentakan lebih keras). Hotspot resource sesungguhnya = halaman tunggu: SSE polling per-koneksi tiap 2s → tiap penunggu memicu 1 query PG (`findCategory`, redundan) + 1 panggilan Redis per tick. **Cache kategori in-memory TTL 60s SUDAH implemented** (`getCachedCategory` di `queueService.js`, live prod) — roadmap broadcast per-tick/pub-sub tetap berlaku untuk skala lebih besar. Hasil ukur t3.micro: ~80 req/s total / ~70 joins/s dengan error ~8–9% (beban gabungan join+SSE) — ceiling infra, bukan desain. Ruangan checkout penuh ≠ habis: selama ada lock, slot didaur ulang via TTL/cleanup; true sell-out hanya saat stock 0 + nol lock + antrian tersisa.
- **Status Fase lain:** Fase 0-12 complete, Fase 13 complete, Event Category & Admission=Lock enhancement complete, Rate limiting (app layer) enhancement complete (unit test: 264, integration: 20), **Fase 15 Stress Testing complete**.
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
- [ ] Hardening `x-k6-test-key` bypass (temuan Fase 15) — header `stress-test-secret` di `rateLimiter.js` mem-bypass SEMUA limiter dan secret-nya hardcoded di repo publik; siapa pun bisa bypass rate limit produksi. Opsi: gate by env (hanya non-production) atau hapus total + andalkan `.env` 99999 untuk stress test. Prioritas: sebelum event publik pertama
- [ ] Ketahanan auth saat flash crowd — bcrypt ~65–300 ms CPU menjadikan login endpoint terberat di aplikasi (~3–15 login/detik per instance); tangga mitigasi: session/JWT panjang agar surge menyusut ke user baru saja → replika backend horizontal di belakang nginx upstream (login stateless, mudah dikalikan) → worker-thread untuk hashing → opsi roadmap jauh: waiting room anonim ala Ticketmaster sebelum login. Prinsip: limiter menjaga dari yang abnormal, kapasitas melayani yang normal — ukuran limiter tidak boleh lebih ketat dari demand sah
- [ ] Adaptive pass-through + estimasi tunggu (pola industri Cloudflare Waiting Room/Queue-it/AWS VWR) — saat laju kedatangan rendah & antrian kosong: buyer lolos langsung ke checkout tanpa halaman waiting (alasan utamanya bukan kecepatan, melainkan ruang tunggu hanya tampil saat ia berarti); saat serbuan: antrean aktif otomatis. Sinyal deteksi = LAJU kedatangan vs kapasitas layan, BUKAN total customer vs quota (4.999 klik bersamaan tetap perang meski < kuota) + hysteresis anti-flapping; bypass inline wajib atomicity (Lua script) agar tak race dual-path dengan dequeuer. Pendamping UX: estimasi waktu tunggu dari riwayat throughput (Cloudflare menampilkan ini; kita baru punya angka posisi), plus catatan opsi pre-queue acak/lotre ala Ticketmaster sebagai senjata anti-bot. Trigger: produksi nyata dengan event rush sungguhan. Konteks pembanding: CF membatasi concurrent sessions aktif (pintu berputar), sistem kita membatasi stok inventori (satu arah) — kelas masalah berbeda, FIFO absolut tetap identitas kita
- [ ] Known-limitation Redis re-init/rekonsiliasi — counter `stock:` dan antrian hidup di Redis; bila Upstash ter-flush, order tetap ada di Postgres tetapi stok/antrian hilang → siapkan prosedur re-init (`stock = quota − order aktif/lunas` dihitung dari DB) atau job rekonsiliasi berkala; untuk MVP cukup didokumentasikan sebagai runbook pemulihan, bukan kode baru
