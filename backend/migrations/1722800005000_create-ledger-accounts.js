/**
 * Tabel ledger_accounts.
 * Sengaja cuma 4 jenis akun (bukan chart of accounts generik) sesuai
 * keputusan anti-overengineering di PRD:
 *   - buyer_wallet        (owner_id -> buyer)
 *   - organizer_pending   (owner_id -> organizer, dana masih ditahan)
 *   - organizer_available (owner_id -> organizer, dana sudah released)
 *   - platform_revenue    (owner_id NULL, akun sistem, cuma 1 baris)
 *
 * owner_id + account_type unik per user (1 user cuma 1 akun per jenis).
 * platform_revenue dijaga singleton lewat partial unique index terpisah,
 * karena unique constraint biasa tidak menjamin itu saat owner_id NULL.
 */

exports.up = (pgm) => {
  pgm.createTable('ledger_accounts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    owner_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'RESTRICT',
    },
    account_type: {
      type: 'varchar(30)',
      notNull: true,
      check:
        "account_type IN ('buyer_wallet', 'organizer_pending', 'organizer_available', 'platform_revenue')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('ledger_accounts', 'ledger_accounts_owner_type_unique', {
    unique: ['owner_id', 'account_type'],
  });

  pgm.createIndex('ledger_accounts', 'account_type', {
    unique: true,
    where: "account_type = 'platform_revenue'",
    name: 'ledger_accounts_platform_singleton',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ledger_accounts');
};
