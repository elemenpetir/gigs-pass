const pool = require("../config/db");

const ACCOUNT_COLUMNS = "id, owner_id, account_type, created_at";
const ENTRY_COLUMNS =
  "id, order_id, account_id, entry_type, amount, description, created_at";

const getOrCreateAccount = async (client, ownerId, accountType) => {
  const query = `
    INSERT INTO ledger_accounts (owner_id, account_type)
    VALUES ($1, $2)
    ON CONFLICT (owner_id, account_type) DO NOTHING
    RETURNING ${ACCOUNT_COLUMNS};
  `;
  const inserted = await client.query(query, [ownerId, accountType]);
  if (inserted.rows[0]) {
    return inserted.rows[0];
  }
  const found = await client.query(
    `
      SELECT ${ACCOUNT_COLUMNS}
      FROM ledger_accounts
      WHERE owner_id = $1 AND account_type = $2;
    `,
    [ownerId, accountType],
  );
  return found.rows[0] || null;
};

const getPlatformRevenueAccount = async (client) => {
  const query = `
    SELECT ${ACCOUNT_COLUMNS}
    FROM ledger_accounts
    WHERE account_type = 'platform_revenue'
    LIMIT 1;
  `;
  const result = await client.query(query);
  return result.rows[0] || null;
};

const insertEntry = async (client, entry) => {
  const query = `
    INSERT INTO ledger_entries (order_id, account_id, entry_type, amount, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING ${ENTRY_COLUMNS};
  `;
  const result = await client.query(query, [
    entry.orderId,
    entry.accountId,
    entry.entryType,
    entry.amount,
    entry.description,
  ]);
  return result.rows[0];
};

const getBalance = async (accountId) => {
  const query = `
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) AS balance
    FROM ledger_entries
    WHERE account_id = $1;
  `;
  const result = await pool.query(query, [accountId]);
  return parseInt(result.rows[0].balance, 10);
};

const findByOrderId = async (orderId) => {
  const query = `
    SELECT ${ENTRY_COLUMNS}
    FROM ledger_entries
    WHERE order_id = $1
    ORDER BY created_at ASC;
  `;
  const result = await pool.query(query, [orderId]);
  return result.rows;
};

module.exports = {
  getOrCreateAccount,
  getPlatformRevenueAccount,
  insertEntry,
  getBalance,
  findByOrderId,
};
