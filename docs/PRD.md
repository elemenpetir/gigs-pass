# PRD — Platform Ticketing Event dengan Virtual Queue & Internal Ledger System

## 1. Ringkasan Proyek

**Nama proyek:** Platform Ticketing Event dengan Virtual Queue & Internal Ledger System
**Tipe proyek:** Fullstack web app (REST API + React frontend) untuk Proyek 2
**Target roadmap:** Bulan 5 (Agustus), deadline fitur core akhir Agustus
**Stack utama:** Node.js, Express.js, PostgreSQL (Supabase/Neon), Redis (Upstash), Server-Sent Events (SSE), React (Vite), Docker Compose, deploy ke AWS EC2

Project ini adalah platform penjualan tiket event/konser yang menyelesaikan dua kelas masalah backend yang berbeda dari Proyek 1 (AssetShield):

1. **Concurrency & scalability** — mencegah overselling dan sistem down saat lonjakan traffic tinggi (war tiket).
2. **Financial data integrity** — memastikan setiap transaksi uang tercatat presisi dan auditable lewat double-entry ledger.

---

## 2. Problem Statement

### 2.1 Masalah Concurrency

Saat penjualan tiket event populer dibuka, ribuan orang mengakses sistem secara bersamaan dalam hitungan detik. Sistem naif tanpa penanganan concurrency berisiko:

- **Overselling** — kursi/kuota tiket yang sama terjual ke lebih dari satu orang akibat race condition.
- **Sistem down/lambat** — semua request diproses bersamaan tanpa kontrol, database dan server kewalahan.

### 2.2 Masalah Financial Integrity

Di platform ticketing nyata (dikonfirmasi dari data resmi Loket.com), dana dari pembeli tiket **tidak langsung dicairkan** ke organizer. Dana ditahan (escrow) sampai event selesai, untuk melindungi pembeli dan menjaga kredibilitas platform. Selain itu:

- Setiap transaksi harus bisa dipertanggungjawabkan (berapa masuk ke organizer, berapa jadi fee platform, berapa di-refund).
- Tidak boleh ada uang yang "hilang" atau "muncul" tanpa jejak akibat bug atau proses yang gagal di tengah jalan.

### 2.3 Batasan yang Disengaja

Sistem **tidak** berperan menyelidiki/memverifikasi apakah suatu event scam atau tidak — itu di luar tanggung jawab platform (sesuai riset alur nyata Loket.com). Sistem hanya mengelola **kapan dan bagaimana dana boleh berpindah tangan**.

---

## 3. Tujuan Proyek

### Tujuan utama

Membangun platform ticketing dengan mekanisme virtual queue untuk menangani lonjakan traffic, dan internal ledger system untuk mengelola aliran dana secara auditable, sebagai pembeda dari CRUD + role-based access biasa yang sudah dibangun di AssetShield.

### Tujuan teknis

- Menerapkan virtual waiting room dengan Redis Sorted Set.
- Menerapkan seat/slot locking dengan TTL untuk mencegah overselling.
- Menerapkan real-time update posisi antrian dengan SSE.
- Menerapkan double-entry ledger untuk pencatatan transaksi.
- Menerapkan alur escrow (holding period) sebelum dana dicairkan ke organizer.
- Menerapkan connection pooling PostgreSQL yang tepat untuk menahan beban tinggi.
- Membuktikan sistem tahan traffic tinggi lewat stress testing (k6).
- Containerized dengan Docker Compose, deploy ke AWS EC2.

---

## 4. Target User & Role

### 4.1 Buyer

- Browse event **tanpa perlu login**.
- Lihat detail event (gambar, deskripsi, kategori tiket, sisa kuota).
- Checkout tiket **wajib login**.
- Masuk virtual queue saat traffic tinggi, lihat posisi antrian real-time.
- Melakukan pembayaran (mock/simulate untuk MVP).
- Melihat riwayat pesanan tiket.

### 4.2 Event Organizer

- Login.
- Membuat/mengelola event (judul, deskripsi ala artikel, gambar, tanggal).
- Membuat kategori tiket & kuota per kategori.
- Melihat penjualan tiket per event (dashboard).
- Melaporkan pembatalan event secara resmi (memicu refund).
- Menarik dana yang sudah `released` (di luar sistem transaksional, cukup dicatat status).

### 4.3 Admin

- Mengontrol event status: suspend (freeze, investigasi) atau cancel (refund) hanya jika belum digelar
- Melihat seluruh transaksi & status ledger lintas event
- Melakukan manual override status dana (dipicu laporan eksternal/investigasi manual)
- Melihat dashboard statistik platform secara keseluruhan

Role tetap **hardcode sederhana** (`buyer`, `organizer`, `admin`) — bukan dynamic RBAC, untuk menjaga scope tetap terkendali.

---

## 5. Scope MVP

### 5.1 Authentication & Authorization

- Register/login user (buyer & organizer).
- JWT token.
- Middleware auth & role-based access.
- Browse event tanpa login; checkout & aksi organizer/admin wajib login.

### 5.2 Event Management

- CRUD event (organizer).
- Upload gambar event via Cloudinary (free tier) — memenuhi requirement upload file.
- Deskripsi event dalam format konten dinamis (gambar + teks, ala halaman artikel).
- Kategori tiket & kuota per kategori.
- Organizer bisa publish event sendiri (status draft → published).
- Admin bisa suspend/cancel event hanya jika belum digelar, cancel juga memicu refund di orders terkait.

### 5.3 Virtual Queue

- Buyer masuk antrian virtual saat traffic tinggi (Redis Sorted Set, FIFO ketat via score monotonic counter `queue:seq` — bukan timestamp).
- Throttled entry — sejumlah buyer per interval waktu ditarik masuk ke tahap checkout.
- Posisi antrian ditampilkan real-time ke buyer via SSE.

### 5.4 Checkout & Reservation (General Admission)

- Tidak ada kursi bernomor — "slot" = satu unit kuota (general admission). Buyer yang lolos dequeue (ditandai `granted:category:{id}:buyer:{uid}` EX 300) berhak mengunci slot.
- Begitu buyer masuk checkout, slot/kuota tiket dikunci sementara atas nama buyer (`lock:category:{id}:buyer:{uid}` EX 300 NX), stok di-`DECR`.
- Jika tidak dibayar dalam waktu tersebut, lock otomatis lepas (Redis expiry), kuota kembali tersedia (`INCR`) — dipastikan oleh cleanup di awal tiap tick `queueDequeuer` (interval 5s, scan `lockexpiry:category:{id}`) yang melepas lock kadaluwarsa + mengembalikan stock + menandai order `awaiting_payment` → `expired`.
- Order dibuat di PostgreSQL berstatus `awaiting_payment` saat lock berhasil; tercatat final (status `pending`) hanya setelah pembayaran berhasil.
- One-shot admission: buyer yang gagal bayar / lock-nya expired harus join antrian lagi dari belakang.

### 5.5 Payment (MVP)

- Endpoint mock/simulate pembayaran (bukan Xendit sandbox beneran untuk MVP).
- Xendit sandbox integration menjadi **enhancement** kalau waktu memungkinkan.

### 5.6 Internal Ledger System

- Double-entry bookkeeping — setiap transaksi menyentuh minimal 2 akun (debit & kredit), selalu balance.
- 4 jenis akun: `buyer_wallet`, `organizer_pending`, `organizer_available`, `platform_revenue`.
- Split otomatis: pembayaran buyer → sebagian ke `organizer_pending`, sebagian ke `platform_revenue` (komisi platform, persentase = konstanta `PLATFORM_COMMISSION_PERCENT`, default 10%).
- Jumlah transaksi memakai `orders.amount` — snapshot `ticket_categories.price` saat order dibuat, jadi harga yang dipakai ledger tidak berubah walau kategori diedit organizer.
- `ledger_entries` bersifat **immutable** — koreksi dilakukan lewat entri baru (reversing entry), bukan edit entri lama.
- Saldo dihitung dari `SUM` seluruh entri terkait, bukan kolom balance yang di-update langsung.

### 5.7 Alur Dana (Escrow / Holding Period)

Status disimpan di `orders.status`, bukan di `ledger_entries`:

```
awaiting_payment (order dibuat saat lock, belum bayar)
   ↓
pending (dana masuk, event belum terjadi)
   ↓
holding_period (event selesai, dana ditahan contoh 7 hari)
   ├── organizer lapor batal resmi → refund_triggered → dana balik ke buyer
   ├── admin manual override (dari laporan eksternal/investigasi manual) → held / refunded
   └── holding period habis tanpa masalah → released → dana cair ke organizer
```

- Transisi `pending → holding_period` dan `holding_period → released` dijalankan scheduled job `orderLifecycle` (default tiap 24 jam). Saat `released`, ledger memindahkan saldo `organizer_pending` → `organizer_available` (reversing-adjacent entry, bukan UPDATE baris lama).
- Refund (event batal resmi atau admin override `refunded`) membuat reversing entry: kredit `buyer_wallet` = amount, debit `organizer_pending` (bagian organizer), debit `platform_revenue` (komisi) — menyeimbangkan transaksi pembayaran asli.
- Hanya order yang **sudah dibayar** (`pending`/`holding_period`) yang ikut refund saat event di-cancel; order `awaiting_payment` dibiarkan expire melalui lock cleanup.

Setelah `released`, dana di luar kendali sistem — sengketa lanjutan menjadi ranah organizer-customer atau pihak berwenang, bukan tanggung jawab platform.

**Catatan desain penting:** sengaja **tidak ada** dispute window otomatis yang dipicu customer (misal tombol "report scam" yang otomatis menahan dana). Ini dikonfirmasi bukan pola nyata platform ticketing — trigger refund hanya dari organizer yang membatalkan resmi, atau intervensi manual admin.

### 5.8 Dashboard Statistik

- Total revenue per event, breakdown platform-fee vs organizer-payout.
- Tiket terjual per kategori vs sisa kuota.
- Statistik antrian (jumlah di waiting room, rata-rata waktu tunggu).
- Conversion rate (checkout dimulai vs pembayaran berhasil vs lock expired).

### 5.9 Real-Time Update

- Posisi antrian buyer di-update real-time via **Server-Sent Events (SSE)** — dipilih karena kebutuhan cukup 1 arah (server → client), lebih sederhana dari WebSocket untuk kasus ini.

---

## 6. Struktur Redis (Detail Teknis)

### 6.1 Virtual Queue — Sorted Set

```
Key    : queue:event:{event_id}:{category_id}
Member : buyer_id (atau session_id)
Score  : monotonic counter dari INCR queue:seq (FIFO ketat, bukan timestamp)

ZADD queue:event:123:cat:1 <score_dari_INCR> <buyer_id> → masuk antrian
ZRANK queue:event:123:cat:1 <buyer_id>                   → cek posisi
ZPOPMIN queue:event:123:cat:1 <N>                        → tarik N buyer ke checkout (throttled entry)
```

### 6.2 Reservation Lock (General Admission) — String + TTL

```
Key   : lock:category:{category_id}:buyer:{user_id}
Value : "1" (NX menjamin satu buyer max satu lock per kategori)
TTL   : 300 detik (5 menit)

SET lock:category:1:buyer:789 1 EX 300 NX   → reserve slot (gagal = buyer sudah punya lock)
DEL lock:category:1:buyer:789               → bayar sukses (stock TETAP berkurang)
DEL lock:category:1:buyer:789 + INCR stock  → bayar gagal / TTL habis (slot balik ke pool)

Granted marker (bukti lolos dequeue, TTL 300):
  Key   : granted:category:{category_id}:buyer:{user_id}
  Di-set oleh dequeueBatch; wajib ada sebelum reserveSlot.

Lock expiry tracker (Sorted Set, untuk cleanup lock yang ditinggalkan):
  Key   : lockexpiry:category:{category_id}   (member user_id, score = epoch ms expiry)
  ZADD  : saat reserveSlot; ZREM saat confirmSlot/releaseSlot
  Job   : dipanggil di awal processQueueForCategory (queueDequeuer, tiap 5s) → ZRANGEBYSCORE 0 <now> → DEL lock + INCR stock
          + ZREM + order awaiting_payment di-mark expired
```

### 6.3 Sisa Kuota — Atomic Counter

```
Key : stock:category:{category_id}
DECR stock:category:1   → saat lock berhasil
INCR stock:category:1   → saat lock expired/dibatalkan
```

Redis **hanya** dipakai untuk: antrian, lock + lock expiry tracker, granted marker, dan stock counter — tidak dipakai untuk cache umum atau session, untuk menjaga scope tetap terkendali.

---

## 7. Data Model Awal

### 7.1 users
```txt
id (uuid)
name
email
password
role (buyer / organizer / admin)
created_at
updated_at
```

### 7.2 events
```txt
id (uuid)
organizer_id (FK -> users)
title
description (rich content / artikel)
image_url (Cloudinary)
event_date
status (draft / published / suspended / cancelled)
created_at
updated_at
```

### 7.3 ticket_categories
```txt
id (uuid)
event_id (FK -> events)
name
price
quota
created_at
updated_at
```

### 7.4 orders
```txt
id (uuid)
buyer_id (FK -> users)
category_id (FK -> ticket_categories)
status (pending / holding_period / released / refund_triggered / held / refunded)
holding_until (timestamp)
created_at
updated_at
```

### 7.5 ledger_accounts
```txt
id (uuid)
owner_id (FK -> users, nullable untuk akun platform)
account_type (buyer_wallet / organizer_pending / organizer_available / platform_revenue)
created_at
```

### 7.6 ledger_entries
```txt
id (uuid)
order_id (FK -> orders)
account_id (FK -> ledger_accounts)
entry_type (debit / credit)
amount
description
created_at
```
Immutable — tidak ada kolom `updated_at`, tidak pernah di-UPDATE.

---

## 8. API Endpoint Draft

### 8.1 Auth
```txt
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### 8.2 Events (Public + Organizer)
```txt
GET    /api/events                 (public, tanpa login)
GET    /api/events/:id             (public, tanpa login)
POST   /api/events                 (organizer, draft)
PUT    /api/events/:id             (organizer, hanya pemilik)
POST   /api/events/:id/publish     (organizer, hanya pemilik — draft to published)
PUT    /api/events/:id/suspend     (admin — published to suspended, hanya belum digelar)
PUT    /api/events/:id/cancel      (organizer/admin — published/suspended to cancelled, trigger refund)
POST   /api/events/:id/image       (organizer, hanya pemilik)
```

### 8.3 Ticket Categories
```txt
GET    /api/events/:id/categories
POST   /api/events/:id/categories  (organizer)
PUT    /api/categories/:id         (organizer)
```

### 8.4 Virtual Queue
```txt
POST /api/queue/:categoryId/join (buyer masuk antrian, wajib login)
GET /api/queue/:categoryId/stream (SSE endpoint, update real-time; auth via Bearer header)
# GET /api/queue/:categoryId/status TIDAK dibuat — cek posisi cukup via SSE stream
```

### 8.5 Checkout & Order
```txt
POST /api/checkout/:categoryId/lock    (kunci slot/reservasi, mulai TTL)
POST /api/orders                       (buat order setelah lock berhasil)
POST /api/orders/:id/pay               (mock/simulate payment)
GET  /api/orders                       (riwayat order buyer)
```

### 8.6 Ledger & Payout
```txt
GET  /api/organizer/:id/ledger-summary
POST /api/organizer/events/:id/cancel        (organizer lapor batal resmi -> refund_triggered)
POST /api/admin/orders/:id/override          (admin manual override status)
GET  /api/admin/ledger/transactions
```

### 8.7 Analytics
```txt
GET /api/analytics/event/:id/overview
GET /api/analytics/platform/overview   (admin)
```

---

## 9. Testing Scope

### 9.1 Unit / Integration Test
- Auth login/register.
- Event & kategori tiket CRUD.
- Virtual queue join & posisi.
- Seat lock berhasil & expired.
- Ledger entry balance (debit = kredit) untuk setiap transaksi.
- Alur refund_triggered saat organizer cancel event.

### 9.2 Stress Testing (k6)

Dijalankan bertahap (mulai 20-50 VU, naik bertahap), idealnya generator traffic dari luar AWS (misal GitHub Actions) agar tidak membebani biaya compute sendiri.

Hal yang harus dibuktikan:
1. **No overselling** — simulasi banyak concurrent request rebutan kuota terbatas, jumlah order sukses harus tepat sama dengan kuota.
2. **Queue ordering tetap benar** di bawah beban tinggi (FIFO konsisten).
3. **TTL expiry bekerja** — slot yang tidak dibayar benar-benar ter-release balik ke stok.
4. **Response time** tetap wajar saat traffic naik (p95/p99 response time, error rate).

Hasil stress test (angka konkret) didokumentasikan di README sebagai bukti empiris, bukan klaim.

---

## 10. Non-Functional Requirements

- `.env` tidak boleh di-commit.
- Password harus di-hash.
- Semua protected route wajib memakai JWT middleware.
- `ledger_entries` bersifat immutable — tidak ada operasi UPDATE/DELETE.
- Connection pooling PostgreSQL dikonfigurasi eksplisit (batas maksimal koneksi sesuai limit provider).
- Redis hanya dipakai untuk antrian, lock, dan counter — tidak untuk cache umum/session.
- README harus menjelaskan problem, arsitektur, tech stack, setup, API, ERD, dan hasil stress test.

### Prinsip Anti-Overengineering (disepakati eksplisit)
- Ledger cukup 4 jenis akun, tidak generik.
- Role tetap hardcode (buyer/organizer/admin), bukan dynamic RBAC.
- Tidak ada dispute window otomatis dari customer.
- Xendit tetap nice-to-have, boleh dikorbankan lebih dulu.
- Real-time cukup SSE, tidak perlu upgrade ke WebSocket kecuali ada kebutuhan konkret.

---

## 11. Deployment

- **Compute:** AWS EC2 (bukan Render — WebSocket/SSE lebih stabil, tidak ada idle spin-down).
- **Database:** PostgreSQL via Supabase atau Neon (free tier).
- **Redis:** Upstash free tier (500K command/bulan).
- **Cloud storage gambar:** Cloudinary free tier.
- **Containerization:** Docker Compose (backend + frontend + reverse proxy).
- **Budget control:** AWS Budgets dengan alert aktif (sudah di-setup).
- Hindari NAT Gateway / Load Balancer untuk menjaga biaya tetap nol.

---

## 12. Out of Scope untuk MVP

- Xendit sandbox integration beneran (jadi enhancement).
- Dynamic RBAC / permission builder.
- Dispute window otomatis yang dipicu customer.
- WebSocket (cukup SSE untuk MVP).
- Verifikasi otomatis kredibilitas event/organizer (KTP, dsb — disederhanakan jadi admin approve manual).
- Notifikasi email/push.

---

## 13. CV Positioning

Draft wording:

```txt
Platform Ticketing Event dengan Virtual Queue & Internal Ledger System
Built a fullstack ticketing platform handling high-demand traffic spikes through
a Redis-based virtual waiting room, TTL seat locking, and real-time queue updates
(SSE), paired with a double-entry ledger system for auditable fund management,
escrow-style payout, and automated refund flows. Validated system correctness
under load (no overselling) through k6 stress testing.
```

---

## 14. Success Criteria

Project dianggap selesai untuk MVP jika:

- Auth dan role (buyer/organizer/admin) berjalan.
- Event & kategori tiket CRUD berjalan, termasuk upload gambar.
- Virtual queue & throttled entry berjalan, posisi antrian update real-time (SSE).
- Seat lock TTL berjalan, terbukti tidak ada overselling lewat stress test k6.
- Ledger double-entry tercatat presisi untuk setiap transaksi (debit = kredit).
- Alur dana (pending → holding_period → released/refund_triggered) berjalan sesuai desain.
- Admin manual override berfungsi.
- Dashboard statistik menampilkan data dari ledger & queue.
- Docker Compose menjalankan seluruh stack dengan benar.
- Deploy sukses ke AWS EC2 dalam batas free tier / AWS Budgets.
- README lengkap dengan hasil stress test terlampir.
