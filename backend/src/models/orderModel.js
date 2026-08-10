const pool = require("../config/db");

const createOrder = async (buyerId, categoryId) => {
  const query = `
    INSERT INTO orders (buyer_id, category_id, status)
    VALUES ($1, $2, 'awaiting_payment')
    RETURNING id, buyer_id, category_id, status, paid_at, created_at, updated_at;
  `;
  const result = await pool.query(query, [buyerId, categoryId]);
  return result.rows[0];
};

const findActiveByBuyerAndCategory = async (buyerId, categoryId) => {
  const query = `
    SELECT id, buyer_id, category_id, status, paid_at, created_at, updated_at
    FROM orders
    WHERE buyer_id = $1 AND category_id = $2
      AND status IN ('awaiting_payment', 'pending')
    LIMIT 1;
  `;
  const result = await pool.query(query, [buyerId, categoryId]);
  return result.rows[0] || null;
};

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
  createOrder,
  findActiveByBuyerAndCategory,
  markRefundTriggeredByEventId,
};
