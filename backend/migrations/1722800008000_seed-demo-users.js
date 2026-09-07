/**
 * Seed 3 akun demo (buyer/organizer/admin) untuk recruiter mencoba aplikasi
 * tanpa perlu register. Password semua akun: demo1234 (bcrypt pre-hashed).
 * Idempotent: ON CONFLICT DO NOTHING.
 */

const DEMO_PASSWORD_HASH = '$2b$10$641x9a7iy8N8A.G5ZRjnNe25gUd9eqt2Vqcnd4i23Vg.p.p5RShVC';

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO users (name, email, password, role)
    VALUES
      ('Demo Buyer', 'demo.buyer@gigspass.com', '${DEMO_PASSWORD_HASH}', 'buyer'),
      ('Demo Organizer', 'demo.organizer@gigspass.com', '${DEMO_PASSWORD_HASH}', 'organizer'),
      ('Demo Admin', 'demo.admin@gigspass.com', '${DEMO_PASSWORD_HASH}', 'admin')
    ON CONFLICT (email) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM users WHERE email IN (
      'demo.buyer@gigspass.com',
      'demo.organizer@gigspass.com',
      'demo.admin@gigspass.com'
    );
  `);
};
