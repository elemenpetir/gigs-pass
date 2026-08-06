/**
 * Setup dasar sebelum tabel dibuat:
 * - pgcrypto: menyediakan gen_random_uuid() untuk primary key UUID
 * - set_updated_at(): trigger function generik, dipakai ulang di semua tabel
 *   yang punya kolom updated_at (kecuali ledger_entries yang immutable)
 */

exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createFunction(
    'set_updated_at',
    [],
    {
      returns: 'trigger',
      language: 'plpgsql',
      replace: true,
    },
    `
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    `
  );
};

exports.down = (pgm) => {
  pgm.dropFunction('set_updated_at', []);
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
