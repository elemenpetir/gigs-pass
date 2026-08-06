/**
 * Tabel orders.
 * Status alur dana disimpan DI SINI, bukan di ledger_entries (yang immutable).
 *
 * State machine:
 *   pending -> holding_period -> released
 *                              -> refund_triggered (organizer cancel resmi)
 *                              -> held / refunded (admin manual override,
 *                                 hanya berlaku selama holding_period berjalan)
 */

exports.up = (pgm) => {
  pgm.createTable('orders', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    buyer_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'ticket_categories',
      onDelete: 'RESTRICT',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'pending',
      check:
        "status IN ('pending', 'holding_period', 'released', 'refund_triggered', 'held', 'refunded')",
    },
    holding_until: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('orders', 'buyer_id');
  pgm.createIndex('orders', 'category_id');
  pgm.createIndex('orders', 'status');

  pgm.createTrigger('orders', 'set_orders_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('orders');
};
