/**
 * Tabel orders.
 * Status alur dana disimpan DI SINI, bukan di ledger_entries (yang immutable).
 *
 * State machine:
 *   awaiting_payment (dibuat saat lock, belum bayar) -> pending (sudah dibayar)
 *     -> holding_period -> released
 *                        -> refund_triggered (organizer cancel resmi)
 *                        -> held / refunded (admin manual override,
 *                           hanya berlaku selama holding_period berjalan)
 *   expired (order tidak terbayar: lock TTL habis / gagal bayar)
 *
 * `pending` berarti "dana masuk" (sudah dibayar) sesuai PRD 5.7 -- order yang
 * belum dibayar memakai status `awaiting_payment`, bukan `pending`.
 */

exports.up = (pgm) => {
  pgm.createTable("orders", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    buyer_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "RESTRICT",
    },
    category_id: {
      type: "uuid",
      notNull: true,
      references: "ticket_categories",
      onDelete: "RESTRICT",
    },
    status: {
      type: "varchar(20)",
      notNull: true,
      default: "pending",
      check:
        "status IN ('pending', 'holding_period', 'released', 'refund_triggered', 'held', 'refunded', 'awaiting_payment', 'expired')",
    },
    /**
     * Harga tiket (integer, dalam rupiah) yang disnap dari
     * ticket_categories.price saat order dibuat (Fase 7). Ledger entries
     * memakai nilai snapshot ini, jadi aman walau harga kategori diubah
     * organizer setelah order dibuat. Komisi platform dihitung dari sini.
     */
    amount: {
      type: "integer",
      notNull: true,
      default: 0,
      check: "amount >= 0",
    },
    holding_until: { type: "timestamptz" },
    /**
     * Mencatat kapan pembayaran berhasil (nullable) -- jawaban eksplisit
     * "apakah order sudah dibayar" tanpa mengubah status machine escrow.
     * Semantik status (Fase 5, general admission):
     *   awaiting_payment -- order dibuat saat lock berhasil, BELUM dibayar
     *   pending          -- dana sudah masuk, menunggu event_date
     *   expired          -- order tidak terbayar (lock TTL habis / gagal bayar)
     */
    paid_at: { type: "timestamptz" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("orders", "buyer_id");
  pgm.createIndex("orders", "category_id");
  pgm.createIndex("orders", "status");

  pgm.createTrigger("orders", "set_orders_updated_at", {
    when: "BEFORE",
    operation: "UPDATE",
    function: "set_updated_at",
    level: "ROW",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("orders");
};
