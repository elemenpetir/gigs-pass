# Gigs Pass — Manual UI Testing Scenarios

Tujuan: memverifikasi flow queue → admission → checkout → payment dan design rule kunci:

- **One-shot admission** — buyer yang gagal bayar atau lock-nya TTL harus join antrian lagi (AGENTS.md, "Queue & SSE Design")
- **Unpaid-order guard** — join diblokir (`409`) hanya bila buyer punya order `awaiting_payment` untuk tier yang sama **dan** lock masih hidup; order `pending` (sudah bayar) boleh beli lagi — re-buy per tier diizinkan
- **Resume checkout** — order `awaiting_payment` dilanjutkan dari halaman bayar, bukan dibuat duplikat (409 `error.data.order`); dari WaitingRoom, join 409 → redirect otomatis ke halaman checkout
- **TTL lock 300s + cleanup** — lock kedaluwarsa melepas slot, stock dikembalikan, order ditandai `expired`

## Prasyarat / Data Test

- Environment: live `http://13.214.56.223` (rekomendasi, fix sudah ter-deploy) atau lokal (backend + frontend dev, Supabase/Neon, Redis Upstash).
- Akun **organizer** untuk membuat/mempublikasi event.
- Event test "Queue Flow Test" dengan minimal 2 tier:
  - **VIP — quota 2**
  - **GA — quota 1**
- 2 akun **buyer** (Buyer1, Buyer2), jalankan di browser/incognito terpisah.
- Jaga cronologis skenario: tiap skenario memakai tier yang kondisi awalnya sudah diketahui (lihat kolom "Stock awal").
- For setiap skenario, buka DevTools → Network (dan sumber SSE) untuk memverifikasi observables.

## Skenario (T1–T8)

### T1 — Happy path buyer baru
- **Flow:** Buyer1 login → EventDetail. → GET TICKETS pada VIP (stock awal **2/2**). → WaitingRoom sampai grant. → checkout → bayar (mock sukses).
- **Observables (harus benar):**
  - SSE: event `position` (turun) → `granted` → koneksi ditutup.
  - `POST /api/checkout/{cat}/lock` → **200** (tanpa body, bukan 400).
  - `POST /api/orders` → **201**; order `awaiting_payment`.
  - Bayar sukses → order `pending`; My Orders menampilkan 1 order confirmed.
- **Stock akhir:** **1/2** (turun tepat 1).

### T2 — Buyer `pending` boleh beli lagi (re-buy per tier diizinkan)
- **Flow:** Buyer1 (sudah `pending` VIP) → GET TICKETS VIP lagi.
- **Observables (harus benar):**
  - Join antrian **berhasil** (`200`) — guard hanya menahan order `awaiting_payment` yang masih pegang lock, bukan order yang sudah dibayar.
  - Checkout → bayar → order ke-2 `pending`. Persis 2 order valid di My Orders.
- **Stock akhir:** **0/2** (turun 2 total).

### T3 — Tinggalkan pembayaran → resume dalam TTL (tanpa duplikat)
- **Flow:** Buyer2 → GA (stock awal **0/1** diisi skenario ini) → sampai layar bayar (`awaiting_payment`), **keluar app**, balik lagi **< 5 menit** → buka halaman checkout.
- **Observables (harus benar):**
  - Join antrian tetap `409`, tapi WaitingRoom **redirect otomatis** ke halaman checkout (resume), bukan menampilkan panel error.
  - Checkout **resume**: `lock` **200** (lock masih hidup), `POST /api/orders` **409** dengan `data.order.status = awaiting_payment` → frontend menampilkan layar bayar lagi (state `locked`), bukan macet.
  - Bayar → `pending`. Persis **1 order**, **1 stock decrement**.
- **Stock akhir:** **0/1**.

### T4 — Tinggalkan pembayaran > TTL → expired, boleh rejoin
- **Flow:** Buyer2 → tier GA/baru → berhenti di `awaiting_payment`, tunggu **> 5 menit** (biarkan TTL lock expire, cleanup jalan di tick dequeuer).
- **Observables (harus benar):**
  - Order lama → `expired`; My Orders menunjukkan `expired`.
  - Stock balik **+1**.
  - Buyer2 bisa join lagi → order baru `awaiting_payment` (one-shot: harus antri ulang).

### T5 — Lock kadaluarsa saat halaman bayar masih terbuka
- **Flow:** Buyer2 → grant → buka layar bayar, biarkan > TTL **tanpa aksi**, baru klik bayar.
- **Observables (harus benar):**
  - Bayar **gagal** / tampil `expired` (bukan `pending`).
  - Stock kembali ke pool setelah cleanup.

### T6 — Sold-out & no-oversell
- **Flow:** Isi GA penuh (1/1) oleh Buyer2; coba ada buyer lain mencoba masuk.
- **Observables (harus benar):**
  - EventDetail menampilkan **SOLD OUT (0/1)** + tombol GET TICKETS disabled.
  - Bila dipaksa grant → `DECR` stock negatif → rollback (`INCR` + `DEL` lock), buyer tidak di-admit.

### T7 — Independensi per tier
- **Flow:** Buyer1 (`pending` VIP) → coba tier **GA**.
- **Observables (harus benar):** guard **per category**, bukan per event → GA tetap bisa dijoin/dibeli. Order 2 valid. Stock GA sesuai hitungan.

### T8 — SSE flow lengkap
- **Flow:** Buyer baru join, amati Network/source selama WaitingRoom.
- **Observables (harus benar):** urutan `position` (turun) → `granted` → koneksi ditutup bersih (SSE auth via Bearer header).

### T9 — Order `awaiting_payment` tapi lock mati → eager-expire + rejoin
- **Flow:** Buyer2 membuat order `awaiting_payment` (lock hidup), lalu lock dihapus paksa dari Redis (mis. `DEL lock:category:{catId}:buyer:{uid}` — simulasi lock hilang tanpa menunggu TTL), kembali ke GET TICKETS → WaitingRoom.
- **Observables (harus benar):**
  - Join **`200`** (bukan `409`) — guard mengecek liveness lock (`lockService.getReservation`), bukan sekadar kehadiran order.
  - Order lama otomatis ditandai **`expired`** (eager-expire oleh `joinQueue`) dan stock lanjut ke buyer ini / diserap antrian — tetap bebas oversell.
  - Buyer masuk antrian baru (one-shot admission tetap berlaku).

## Verifikasi setiap skenario
- My Orders buyer: status benar (`pending` / `expired` / `awaiting_payment`).
- Badge stock EventDetail `stock/quota` konsisten dengan jumlah order aktif (paid & not refunded).

## Lampiran — Pemeriksaan API (opsional, presisi)
Saat dibutuhkan tanpa UI:

- `POST /api/checkout/{catId}/lock` **tanpa body** → `200` (ada lock) / `403` (tanpa lock). Regresi bug lama muncul sebagai `400`.
- `POST /api/orders {categoryId}` tanpa lock → `403 "No active reservation"`; dengan order `awaiting_payment` yang live → `409` + body memuat `data.order.status`; dengan order `pending` + lock valid → `201` (order ke-2, re-buy diizinkan).
- `POST /api/queue/{catId}/join` dengan order `awaiting_payment` + lock hidup → `409` + pesan guard "finish your payment"; order `pending` → `200`; order `awaiting_payment` tapi lock mati → `200` + order lama `expired`.
- `GET /orders/{id}` → `200` (resi + JOIN event/category, pemilik saja) / `404` (tidak ada) / `403` (bukan pemilik).
- `lockService.getReservation` → `pttl` sisa (< 300) saat resume.

## Lampiran — Automated integration (opsional)
Cakupan ini juga dibuktikan otomatis di `__tests__/integration/db/` (real DB + Redis, `npm run test:integration`): happy path penuh, join kedua `409`, resume `409 + data.order`, expire via injeksi `lockexpiry` + `cleanupExpiredLocks` → `expired` + stock dipulihkan + rejoin `200`.