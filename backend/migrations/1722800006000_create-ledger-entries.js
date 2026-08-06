/**
 * Tabel ledger_entries.
 * IMMUTABLE by design -- sengaja TIDAK ada kolom updated_at dan TIDAK ada
 * trigger set_updated_at. Koreksi transaksi dilakukan lewat reversing entry
 * (baris baru), bukan UPDATE ke baris lama. Lihat PRD bagian 5.5 & 10.
 *
 * Saldo tiap ledger_accounts dihitung dari SUM entri terkait, bukan kolom
 * balance yang di-update langsung -- itu kenapa ledger_accounts tidak
 * punya kolom balance.
 */

exports.up = (pgm) => {
  pgm.createTable('ledger_entries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'orders',
      onDelete: 'RESTRICT',
    },
    account_id: {
      type: 'uuid',
      notNull: true,
      references: 'ledger_accounts',
      onDelete: 'RESTRICT',
    },
    entry_type: {
      type: 'varchar(10)',
      notNull: true,
      check: "entry_type IN ('debit', 'credit')",
    },
    amount: { type: 'integer', notNull: true, check: 'amount > 0' },
    description: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('ledger_entries', 'order_id');
  pgm.createIndex('ledger_entries', 'account_id');
};

exports.down = (pgm) => {
  pgm.dropTable('ledger_entries');
};
