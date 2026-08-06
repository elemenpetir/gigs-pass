/**
 * Tabel users.
 * Role sengaja hardcode (buyer/organizer/admin) via CHECK constraint,
 * bukan tabel roles/permissions terpisah — sesuai keputusan anti-overengineering di PRD.
 */

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: { type: 'varchar(150)', notNull: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password: { type: 'varchar(255)', notNull: true },
    role: {
      type: 'varchar(20)',
      notNull: true,
      check: "role IN ('buyer', 'organizer', 'admin')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'role');

  pgm.createTrigger('users', 'set_users_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'set_updated_at',
    level: 'ROW',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
