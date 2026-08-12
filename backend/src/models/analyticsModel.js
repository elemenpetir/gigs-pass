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

const getPlatformOverview = async () => {
  const [revenue, refunded, byStatus, events, buyers, platformBalance] =
    await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(amount), 0)::int AS gross,
               COUNT(*)::int AS count
        FROM orders
        WHERE status IN ${PAID_STATUSES};
      `),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0)::int AS amount,
               COUNT(*)::int AS count,
               COALESCE(COUNT(*) FILTER (WHERE refund_reason = 'event_cancelled'), 0)::int AS event_cancelled,
               COALESCE(COUNT(*) FILTER (WHERE refund_reason = 'admin_override'), 0)::int AS admin_override
        FROM orders
        WHERE status = 'refunded';
      `),
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM orders
        GROUP BY status;
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'published')::int AS published,
               COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM events;
      `),
      pool.query(`
        SELECT COUNT(DISTINCT buyer_id)::int AS total
        FROM orders;
      `),
      pool.query(`
        SELECT COALESCE(
          SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END),
          0
        )::int AS balance
        FROM ledger_entries le
        JOIN ledger_accounts a ON a.id = le.account_id
        WHERE a.account_type = 'platform_revenue';
      `),
    ]);

  return {
    revenue: {
      gross: revenue.rows[0].gross,
      count: revenue.rows[0].count,
    },
    refunded: {
      amount: refunded.rows[0].amount,
      count: refunded.rows[0].count,
      eventCancelled: refunded.rows[0].event_cancelled,
      adminOverride: refunded.rows[0].admin_override,
    },
    byStatus: byStatus.rows,
    events: events.rows[0],
    buyers: buyers.rows[0].total,
    platformRevenueBalance: platformBalance.rows[0].balance,
  };
};

module.exports = {
  getEventOverview,
  getOrganizerFundBalance,
  getPlatformOverview,
};