/**
 * Seed 1 baris akun platform_revenue (akun sistem, owner_id NULL).
 * Dibuat sekali di sini supaya application code tidak perlu cek-atau-buat
 * akun ini setiap kali proses split komisi berjalan -- cukup query dengan
 * WHERE account_type = 'platform_revenue'.
 */

exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO ledger_accounts (account_type)
    VALUES ('platform_revenue');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM ledger_accounts WHERE account_type = 'platform_revenue';
  `);
};
