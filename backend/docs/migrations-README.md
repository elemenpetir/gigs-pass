# Database Migrations

Menggunakan [node-pg-migrate](https://github.com/salsita/node-pg-migrate). PostgreSQL hosted di Supabase/Neon (free tier).

## Setup

```bash
npm install --save-dev node-pg-migrate
npm install pg
```

Tambahkan ke `.env`:

```
DATABASE_URL=postgres://user:password@host:port/database
```

Tambahkan script ke `package.json`:

```json
{
  "scripts": {
    "migrate:up": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create"
  }
}
```

## Menjalankan migration

```bash
npm run migrate:up      # jalankan semua migration yang belum diterapkan
npm run migrate:down    # rollback 1 migration terakhir
```

## Urutan migration

1. `setup-extensions-and-triggers` — pgcrypto (UUID) + trigger function `set_updated_at`
2. `create-users`
3. `create-events`
4. `create-ticket-categories`
5. `create-orders` — status alur dana disimpan di sini, lihat komentar di file
6. `create-ledger-accounts` — 4 jenis akun (buyer_wallet, organizer_pending, organizer_available, platform_revenue)
7. `create-ledger-entries` — **immutable**, tidak ada updated_at/trigger update
8. `seed-platform-revenue-account` — insert 1 baris akun sistem

## Catatan desain penting

- **`ledger_entries` tidak pernah di-UPDATE atau di-DELETE dari application code.** Koreksi transaksi = insert baris baru (reversing entry). Ini prinsip inti double-entry ledger yang dirancang di PRD, jangan dilanggar saat implementasi service layer.
- **Saldo akun dihitung dari `SUM` `ledger_entries`**, bukan disimpan sebagai kolom `balance` yang di-update langsung — mencegah saldo "menyimpang" dari histori transaksi aktualnya.
- Struktur antrian (virtual queue) dan seat lock **tidak ada tabelnya di sini** — itu sengaja hidup di Redis (Upstash), lihat PRD bagian 7.
- Redis **tidak** menyimpan uang/saldo apa pun — hanya state sementara (antrian, lock). Semua yang berkaitan dengan uang wajib lewat PostgreSQL.
