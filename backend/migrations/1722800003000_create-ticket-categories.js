/**
 * Tabel ticket_categories.
 * quota di sini adalah kuota TOTAL (sumber kebenaran di PostgreSQL).
 * Sisa kuota real-time saat traffic tinggi dihitung di Redis (stock:category:{id}),
 * bukan query berulang ke tabel ini -- lihat bagian 7 di PRD.
 */

exports.up = (pgm) => {
  pgm.createTable('ticket_categories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events',
      onDelete: 'CASCADE',
    },
    name: { type: 'varchar(100)', notNull: true },
    price: { type: 'integer', notNull: true, check: 'price >= 0' },
    quota: { type: 'integer', notNull: true, check: 'quota >= 0' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('ticket_categories', 'event_id');

  pgm.createTrigger('ticket_categories', 'set_ticket_categories_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_categories');
};
