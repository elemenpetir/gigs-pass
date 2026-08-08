const pool = require("../config/db");

const markRefundTriggeredByEventId = async (eventId) => {
  const query = `
    UPDATE orders
    SET status = 'refund_triggered'
    WHERE category_id IN (SELECT id FROM ticket_categories WHERE event_id = $1)
    RETURNING id, buyer_id, category_id, status, holding_until, created_at, updated_at;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows;
};

module.exports = {
  markRefundTriggeredByEventId,
};
