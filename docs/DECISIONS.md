# DECISIONS — Keputusan Desain Gigs Pass

Satu file untuk semua keputusan desain yang diambil selama implementasi.
Format per entri: Tanggal, Konteks, Keputusan, Konsekuensi.

Aturan file ini:
- Spesifikasi stabil tinggal di `docs/PRD.md` (blueprint, jangan diduplikasi di sini).
- Status kerja harian tinggal di `docs/TASK_BREAKDOWN.md`.
- Entri kedaluwarsa tidak dihapus, melainkan ditandai `Digantikan oleh #N`.
- Ambang pemecahan: jika entri melewati ~30 atau tim bertambah, pecah ke `docs/adr/` bernomor dan file ini menjadi index.

## Antrean dan SSE

### #1 Admission = Lock (2026-08)
- Konteks: Desain awal memakai marker `granted` terpisah lalu lock belakangan saat checkout, membuka loophole re-lock dan satu round trip ekstra.
- Keputusan: Buyer yang diadmit (`ZPOPMIN`) langsung `SET lock EX 300 NX` + `DECR stock` (rollback `INCR` + `DEL` bila negatif) + `ZADD lockexpiry`. Satu grant sama dengan satu kesempatan; gagal bayar atau TTL habis berarti antre ulang.
- Konsekuensi: `POST /api/checkout/:id/lock` menjadi verifikasi reservasi (`getReservation` + `PTTL`); circular require lockService-queueService ikut hilang.

### #2 Interval dequeue 5 detik, batch 50 (2026-08, final)
- Konteks: Perlu throttled entry yang cukup untuk rush tanpa thundering herd.
- Keputusan: Batch 50 per 5 detik (throughput ~600 admit/menit/kategori), keduanya env-overridable (`QUEUE_BATCH_SIZE`, `QUEUE_DEQUEUE_INTERVAL_MS`). Admit stock-driven ditolak untuk MVP (butuh pub/sub trigger).
- Konsekuensi: Cleanup lock tiap tick membuat stok segar kembali maksimal 5 detik setelah lock expire; FIFO ketat via skor `INCR queue:seq`.

### #3 Model beban dan cache kategori in-memory (2026-08)
- Konteks: Review desain + hasil ukur Fase 15 menunjukkan hotspot sesungguhnya adalah halaman tunggu (SSE polling per koneksi tiap 2 detik memicu query PG redundan), bukan ruang checkout yang pasif.
- Keputusan: Cache process-local (`Map` + TTL 60 detik) untuk `ticket_categories` via `getCachedCategory` di `queueService.js`. Larangan Redis tidak dilanggar (cache bukan di Redis).
- Konsekuensi: Query PG per join turun dari 2 ke 1 tanpa hop jaringan dan tanpa infrastruktur baru. Hasil ukur t3.micro (~80 req/s, error ~8-9%) dinyatakan ceiling infra, bukan desain.

### #4 Relabel CTA menjadi GET TICKETS (2026-08)
- Konteks: Label `JOIN QUEUE` di `EventDetailPage` purchase-intent-nya lemah dibanding pola Ticketmaster/Tokopedia.
- Keputusan: Tombol kategori tiket berlabel `GET TICKETS`; alur join, waiting room, dan auto-redirect saat `granted` tidak berubah. `REJOIN QUEUE` di CheckoutPage dipertahankan demi kejujuran konsekuensi one-shot.
- Konsekuensi: Selaras vocabulary `BUY`/`TICKETS` di `docs/design/design.md`.

### #5 Guard tanggal event lampau (2026-09)
- Konteks: Tidak ada penjagaan tanggal di jalur beli maupun UI; tiket event yang sudah digelar tetap bisa dibeli dan tombol Suspend/Cancel tampil walau backend pasti menolak.
- Keputusan: `joinQueue` menolak event lampau (`410 "Event has already ended"`, satu-satunya pintu masuk sehingga menutup semua jalur); `EventDetailPage` menampilkan state `EVENT ENDED` (badge + tombol disabled, kartu tetap sebagai arsip); tombol Suspend/Cancel disembunyikan untuk event lampau di halaman admin dan organizer. Lock dan order yang sudah ada sebelum event lewat tidak terganggu.
- Konsekuensi: Halaman list (Home/Events) sengaja tidak diubah (murni navigasi, tanpa aksi beli). E2E tidak mengcover ini karena create event wajib future date; verifikasi via unit test + cek manual.

### #6 Unpaid-order guard, anti double-unpaid per tier (2026-08)
- Konteks: Buyer yang menelantarkan pembayaran bisa menumpuk order `awaiting_payment` per tier.
- Keputusan: `joinQueue` menolak (409) hanya bila buyer punya order `awaiting_payment` untuk tier yang sama DAN lock masih hidup; begitu lock mati, join diizinkan dan order lama di-eager-expire (tanpa sentuh Redis/stock, cleanup dequeuer yang mengembalikan stock). Order `pending` (sudah bayar) tidak memblokir, re-buy per tier diizinkan. Guard 409 di `POST /api/orders` membawa `error.data.order` agar frontend resume, bukan menganggap sudah beli.
- Konsekuensi: Bebas oversell dengan tetap memaafkan buyer yang lock-nya mati.

## Ledger dan Alur Dana

### #7 Snapshot harga di orders.amount (Fase 7)
- Konteks: Harga kategori bisa diubah organizer kapan pun.
- Keputusan: `orders.amount` disalin dari `ticket_categories.price` saat order dibuat; ledger, refund, dan analytics selalu memakai snapshot ini.
- Konsekuensi: Order lama kebal terhadap edit harga; refund mengembalikan tepat yang dibayar.

### #8 Satu status refunded + refund_reason (Fase 8)
- Konteks: Dua penyebab refund (cancel event vs override admin) sempat berisiko menjadi dua status berbeda.
- Keputusan: Satu status terminal `refunded`; penyebab di kolom `refund_reason` (`event_cancelled` | `admin_override`). Hasil cancel tidak pernah masuk holding (`holding_until` NULL); hasil override pernah. Reversal selalu se-transaksi dengan perubahan status.
- Konsekuensi: Konsumen (badge UI, analytics) hanya bercabang di satu titik.

### #9 Definisi revenue analytics (Fase 9)
- Konteks: Perlu definisi paid-status yang konsisten antara event overview dan platform overview.
- Keputusan: Revenue memakai 4 status (`pending`, `holding_period`, `released`, `held`); `refunded` dihitung terpisah (`refundedAmount`, `netRevenue = revenue - refundedAmount`); `held` tetap masuk revenue dengan breakdown eksplisit. Fund status organizer dari balance akun ledger, bukan SUM orders.
- Konsekuensi: Endpoint `GET /api/analytics/event/:id/overview` (owner check) dan `GET /api/analytics/platform/overview` (admin).

### #10 Perbaikan param overrideStatus (2026-09, temuan E2E)
- Konteks: `POST /api/admin/orders/:id/override` me-return 500 saat dieksekusi live; log PG: `inconsistent types deduced for parameter $2` (dipakai ganda di `SET status = $2` dan `CASE WHEN $2 = ...`, varchar vs text).
- Keputusan: Hitung `refund_reason` di JS, kirim sebagai `$3`. Tiap parameter dipakai sekali.
- Konsekuensi: Kelas bug ini tak terlihat unit mock; regresinya wajib integration test melawan PG nyata (`models.integration.test.js`: held tanpa reason, refunded dengan `admin_override`).

### #11 Event category enum + min_price (enhancement)
- Konteks: Butuh genre/vibe dan harga termurah tanpa N+1 query.
- Keputusan: Kolom `events.category` NOT NULL + CHECK 6 slug (`music`, `festival`, `concert`, `comedy`, `art`, `culture`); list mirror backend `constants.js` dan frontend `lib/categories.js` (ubah keduanya + migration CHECK agar tidak diverge); `GET /api/events` dukung `?category=` dan me-return `min_price` via `MIN(price)` + `GROUP BY`.
- Konsekuensi: Filter client-side sekali fetch; `?category=` untuk deep-link BROWSE VIBES; navbar hanya Discover/Events.

### #12 Refund reason tampil di dashboard (2026-09, temuan E2E)
- Konteks: Halaman admin dan organizer me-render badge status tanpa alasan refund, padahal datanya ada.
- Keputusan: Tampilkan label reason (`EVENT CANCELLED BY THE ORGANIZER` / `ADMIN PUTUSAN`) mengikuti pola `OrderHistoryPage`.
- Konsekuensi: Admin dan organizer bisa membedakan penyebab refund langsung dari tabel.

## Keamanan dan Rate Limit

### #13 Rate limiting aplikasi (selesai)
- Konteks: Butuh presisi per perilaku tanpa menyapu user sah di balik CGNAT.
- Keputusan: Login 10/menit/IP hitung-gagal-saja (`skipSuccessfulRequests`); register 10/menit/IP hitung-semua; join 30/menit/per-user setelah authenticate (kebal NAT); global 600/menit/IP kecuali path `*/stream`; respons 429 ber-envelope; `TRUST_PROXY` env-driven; unlimited saat `NODE_ENV=test` agar suite lama aman.
- Konsekuensi: Lapisan lanjutan anti-abuser yang selalu berhasil (Turnstile/honeypot, HaveIBeenPwned, velocity akun-per-IP) dicatat, dibangun hanya saat ada user dan pembayaran nyata.

### #14 Rate limiting nginx zona tunggal (selesai)
- Konteks: Butuh tembok volumetrik di depan Node.
- Keputusan: Satu zona general ~600r/m per IP (+burst), `limit_req_status 429`, tanpa zona auth khusus. Presisi brute-force milik app limiter; nginx murni volumetrik.
- Konsekuensi: Aktivasi dan verifikasi mengikuti deploy Fase 14.

### #15 Hapus total bypass x-k6-test-key (temuan Fase 15)
- Konteks: Header `stress-test-secret` mem-bypass semua limiter dan secret-nya hardcoded di repo publik.
- Keputusan: Hapus total + 1 unit test regresi + bersih header di `k6-script.js`. Prosedur stress test wajib via `.env` 99999 + nginx no-limit (`docs/deployment.md` pasal 5a).
- Konsekuensi: Tidak ada lagi jalan pintas limiter di codebase.

### #16 JWT fail-fast di production (2026-09, temuan audit secret)
- Konteks: Fallback `"dev-secret-key"` membuat container yang jalan tanpa `JWT_SECRET` menandatangani token dengan kunci publik.
- Keputusan: Throw eksplisit saat modul dimuat bila `NODE_ENV=production` tanpa `JWT_SECRET`; fallback dev tetap berlaku di luar production. Plus 3 unit test.
- Konsekuensi: Misconfig env gagal cepat dengan pesan jelas, bukan jalan dengan kunci palsu.

## Testing

### #17 Validasi sintetis rate limit, monitoring 429 ditutup (2026-09)
- Konteks: Tuning limiter butuh sebaran IP asli yang tidak ada di proyek portfolio.
- Keputusan: Default app (10/10/30/600) divalidasi sintetis (`rateLimiter.defaults.test.js`, pola sah 0 persen 429 + abuse diblokir); tuning nginx/CGNAT dinyatakan di luar lingkup.
- Konsekuensi: Item monitoring 429 ditutup sebagai keterbatasan tertulis, bukan pekerjaan menggantung.

### #18 Harness E2E Playwright (2026-09)
- Konteks: Lapisan test terakhir setelah jest/supertest (API) dan k6 (beban).
- Keputusan: Backend live + PG/Redis nyata, workflow manual (`workflow_dispatch`, meniru `stress-test.yml`), Chromium saja, `workers: 1`, `retries: 2` di CI. Admin di-seed via script (register publik hanya buyer/organizer).
- Konsekuensi: 10 test (smoke, auth, buyer full flow, organizer, admin hold/refund). E2E menemukan 2 bug nyata yang lolos 274 unit test (konflik tipe PG #9, refund reason hilang #11).

### #19 Pelajaran metodologi k6 (insiden terukur)
- Konteks: Flag `--env K6_SCENARIO=` terbukti tidak mengisolasi skenario (800 VU gabungan).
- Keputusan: Run terpisah memakai file single-scenario (`k6-join-only.js`, `k6-sse-only.js`); angka ceiling hanya valid bila beban terisolasi, selalu catat caveat bila tidak.
- Konsekuensi: Hasil 2 run di README dibaca sebagai beban gabungan.
