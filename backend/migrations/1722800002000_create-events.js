/**
 * Tabel events.
 * status: draft -> pending_approval -> published (oleh admin), atau cancelled
 * (organizer lapor batal resmi, memicu refund_triggered di orders terkait).
 */

exports.up = (pgm) => {
  pgm.createTable('events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organizer_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'RESTRICT',
    },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    image_url: { type: 'varchar(500)' },
    event_date: { type: 'timestamptz', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'draft',
      check: "status IN ('draft', 'pending_approval', 'published', 'cancelled')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('events', 'organizer_id');
  pgm.createIndex('events', 'status');
  pgm.createIndex('events', 'event_date');

  pgm.createTrigger('events', 'set_events_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('events');
};
