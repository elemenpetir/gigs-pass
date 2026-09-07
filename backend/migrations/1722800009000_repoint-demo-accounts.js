/**
 * Repoint akun demo ke akun existing yang berisi data nyata:
 * - test@example.com (buyer, 26 orders) dan organizer@example.com (organizer, 4 events)
 *   direset passwordnya ke demo1234 agar tombol demo login bisa dipakai recruiter.
 * - demo.buyer / demo.organizer (akun seed 1722800008000, kosong tanpa data) dihapus.
 * - demo.admin dipertahankan (dashboard admin baca agregat lintas event).
 *
 * DOWN bersifat best-effort: password lama tidak disimpan (sudah diganti),
 * dua akun demo yang dihapus dibuat ulang supaya migrate down tetap linear.
 */

const DEMO_PASSWORD_HASH = '$2b$10$641x9a7iy8N8A.G5ZRjnNe25gUd9eqt2Vqcnd4i23Vg.p.p5RShVC';

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET password = '${DEMO_PASSWORD_HASH}', updated_at = now()
    WHERE email IN ('test@example.com', 'organizer@example.com');

    DELETE FROM users
    WHERE email IN ('demo.buyer@gigspass.com', 'demo.organizer@gigspass.com');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    INSERT INTO users (name, email, password, role)
    VALUES
      ('Demo Buyer', 'demo.buyer@gigspass.com', '${DEMO_PASSWORD_HASH}', 'buyer'),
      ('Demo Organizer', 'demo.organizer@gigspass.com', '${DEMO_PASSWORD_HASH}', 'organizer')
    ON CONFLICT (email) DO NOTHING;
  `);
};
