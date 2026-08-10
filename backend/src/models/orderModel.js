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

const findById = async (id) => {
  const query = `
    SELECT id, buyer_id, category_id, status, paid_at, created_at, updated_at
    FROM orders
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const markPaid = async (id) => {
  const query = `
    UPDATE orders
    SET status = 'pending', paid_at = NOW()
    WHERE id = $1 AND status = 'awaiting_payment'
    RETURNING id, buyer_id, category_id, status, paid_at, created_at, updated_at;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const markExpired = async (id) => {
  const query = `
    UPDATE orders
    SET status = 'expired'
    WHERE id = $1 AND status = 'awaiting_payment'
    RETURNING id, buyer_id, category_id, status, paid_at, created_at, updated_at;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
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

const markExpiredByBuyerAndCategory = async (buyerId, categoryId) => {
  const query = `
    UPDATE orders
    SET status = 'expired'
    WHERE buyer_id = $1 AND category_id = $2 AND status = 'awaiting_payment'
    RETURNING id, buyer_id, category_id, status, paid_at, created_at, updated_at;
  `;
  const result = await pool.query(query, [buyerId, categoryId]);
  return result.rows;
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
  findById,
  markPaid,
  markExpired,
  findActiveByBuyerAndCategory,
  markExpiredByBuyerAndCategory,
  markRefundTriggeredByEventId,
};
