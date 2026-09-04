// Seed E2E admin user (public register only allows buyer/organizer).
// Usage: DATABASE_URL=postgresql://... node scripts/seed-e2e.js
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });
  const email = process.env.E2E_ADMIN_EMAIL || "admin@e2e.local";
  const hash = await bcrypt.hash(
    process.env.E2E_ADMIN_PASSWORD || "AdminPass123!",
    10,
  );
  await pool.query(
    `INSERT INTO users (email, password, role, name)
     VALUES ($1, $2, 'admin', 'E2E Admin')
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'admin'`,
    [email, hash],
  );
  await pool.end();
  console.log(`seed-e2e: admin ${email} ready`);
};

run().catch((error) => {
  console.error(`seed-e2e failed: ${error.message}`);
  process.exit(1);
});
