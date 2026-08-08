const db = require("../../../src/config/db");

const TRUNCATE_TABLES = [
  "ledger_entries",
  "orders",
  "ticket_categories",
  "events",
  "users",
  "ledger_accounts",
];

const truncateAll = async () => {
  await db.query(`TRUNCATE ${TRUNCATE_TABLES.join(", ")} RESTART IDENTITY`);
  await db.query(
    "INSERT INTO ledger_accounts (account_type) VALUES ('platform_revenue')",
  );
};

module.exports = { truncateAll };
