const pool = require("../config/db");

const PAID_STATUSES = "('pending', 'holding_period', 'released', 'held')";

const getEventOverview = async (eventId) => {
  const query = `
    SELECT
      c.id AS category_id,
      c.name,
      c.price,
      c.quota,
      COUNT(o.id) FILTER (WHERE o.status IN ${PAID_STATUSES})::int AS sold_count,
      COALESCE(SUM(o.amount) FILTER (WHERE o.status IN ${PAID_STATUSES}), 0)::int AS sold_amount,
      COUNT(o.id) FILTER (WHERE o.status = 'held')::int AS held_count,
      COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'held'), 0)::int AS held_amount,
      COUNT(o.id) FILTER (WHERE o.status = 'refunded')::int AS refunded_count,
      COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'refunded'), 0)::int AS refunded_amount,
      COUNT(o.id) FILTER (WHERE o.status = 'awaiting_payment')::int AS awaiting_count,
      COUNT(o.id) FILTER (WHERE o.status = 'expired')::int AS expired_count
    FROM ticket_categories c
    LEFT JOIN orders o ON o.category_id = c.id
    WHERE c.event_id = $1
    GROUP BY c.id, c.name, c.price, c.quota
    ORDER BY c.created_at ASC;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows;
};

const getOrganizerFundBalance = async (organizerId, accountType) => {
  const query = `
    SELECT COALESCE(
      SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END),
      0
    ) AS balance
    FROM ledger_entries le
    JOIN ledger_accounts a ON a.id = le.account_id
    WHERE a.owner_id = $1 AND a.account_type = $2;
  `;
  const result = await pool.query(query, [organizerId, accountType]);
  return parseInt(result.rows[0].balance, 10);
};

module.exports = {
  getEventOverview,
  getOrganizerFundBalance,
};