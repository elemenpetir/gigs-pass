const pool = require("../config/db");

const ORDER_COLUMNS = `
  id, buyer_id, category_id, status, amount, paid_at, refund_reason, created_at, updated_at
`;

const LIFE_CYCLE_COLUMNS = `
  o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
  o.holding_until, o.refund_reason, o.created_at, o.updated_at, e.organizer_id
`;

const createOrder = async (buyerId, categoryId, amount) => {
  const query = `
    INSERT INTO orders (buyer_id, category_id, status, amount)
    VALUES ($1, $2, 'awaiting_payment', $3)
    RETURNING ${ORDER_COLUMNS};
  `;
  const result = await pool.query(query, [buyerId, categoryId, amount]);
  return result.rows[0];
};

const findById = async (id) => {
  const query = `
    SELECT ${ORDER_COLUMNS}
    FROM orders
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const findByBuyerId = async (buyerId) => {
  const query = `
    SELECT o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
           o.holding_until, o.refund_reason, o.created_at, o.updated_at,
           c.name AS category_name, c.event_id,
           e.title AS event_title, e.event_date, e.image_url
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    WHERE o.buyer_id = $1
    ORDER BY o.created_at DESC;
  `;
  const result = await pool.query(query, [buyerId]);
  return result.rows;
};

const findByIdWithDetails = async (id) => {
  const query = `
    SELECT o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
           o.holding_until, o.refund_reason, o.created_at, o.updated_at,
           c.name AS category_name, c.event_id,
           e.title AS event_title, e.event_date, e.image_url
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    WHERE o.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const markPaid = async (id, client = pool) => {
  const query = `
    UPDATE orders
    SET status = 'pending', paid_at = NOW()
    WHERE id = $1 AND status = 'awaiting_payment'
    RETURNING ${ORDER_COLUMNS};
  `;
  const result = await client.query(query, [id]);
  return result.rows[0] || null;
};

const markExpired = async (id) => {
  const query = `
    UPDATE orders
    SET status = 'expired'
    WHERE id = $1 AND status = 'awaiting_payment'
    RETURNING ${ORDER_COLUMNS};
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const findUnpaidByBuyerAndCategory = async (buyerId, categoryId) => {
  const query = `
    SELECT ${ORDER_COLUMNS}
    FROM orders
    WHERE buyer_id = $1 AND category_id = $2
      AND status = 'awaiting_payment'
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
    RETURNING ${ORDER_COLUMNS};
  `;
  const result = await pool.query(query, [buyerId, categoryId]);
  return result.rows;
};

const markRefundedByEventId = async (eventId, reason, client = pool) => {
  const query = `
    UPDATE orders
    SET status = 'refunded', refund_reason = $2
    WHERE category_id IN (SELECT id FROM ticket_categories WHERE event_id = $1)
      AND status IN ('pending', 'holding_period')
    RETURNING id, buyer_id, category_id, status, amount, holding_until, refund_reason, created_at, updated_at;
  `;
  const result = await client.query(query, [eventId, reason]);
  return result.rows;
};

const findPaidOrdersWithPastEvent = async () => {
  const query = `
    SELECT ${LIFE_CYCLE_COLUMNS}
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    WHERE o.status = 'pending' AND e.event_date < NOW()
    ORDER BY o.created_at ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
};

const findHoldingPeriodExpired = async () => {
  const query = `
    SELECT ${LIFE_CYCLE_COLUMNS}
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    WHERE o.status = 'holding_period' AND o.holding_until < NOW()
    ORDER BY o.holding_until ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
};

const markHoldingPeriod = async (orderId, holdingUntil) => {
  const query = `
    UPDATE orders
    SET status = 'holding_period', holding_until = $2
    WHERE id = $1 AND status = 'pending'
    RETURNING ${ORDER_COLUMNS}, holding_until;
  `;
  const result = await pool.query(query, [orderId, holdingUntil]);
  return result.rows[0] || null;
};

const markReleased = async (orderId, client = pool) => {
  const query = `
    UPDATE orders
    SET status = 'released'
    WHERE id = $1 AND status = 'holding_period'
    RETURNING ${ORDER_COLUMNS}, holding_until;
  `;
  const result = await client.query(query, [orderId]);
  return result.rows[0] || null;
};

const countSoldByCategoryIds = async (categoryIds) => {
  const query = `
    SELECT category_id::text AS category_id, COUNT(*)::int AS sold
    FROM orders
    WHERE category_id = ANY($1::uuid[])
      AND status IN ('pending', 'holding_period', 'released', 'held')
    GROUP BY category_id;
  `;
  const result = await pool.query(query, [categoryIds]);
  return result.rows;
};

const overrideStatus = async (orderId, status, client = pool) => {
  const refundReason = status === "refunded" ? "admin_override" : null;
  const query = `
    UPDATE orders
    SET status = $2, refund_reason = $3
    WHERE id = $1 AND status = 'holding_period'
    RETURNING ${ORDER_COLUMNS}, holding_until;
  `;
  const result = await client.query(query, [orderId, status, refundReason]);
  return result.rows[0] || null;
};

const findByEventId = async (eventId) => {
  const query = `
    SELECT
      o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
      o.holding_until, o.refund_reason, o.created_at, o.updated_at,
      c.name AS category_name,
      u.name AS buyer_name, u.email AS buyer_email
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    JOIN users u ON u.id = o.buyer_id
    WHERE c.event_id = $1
    ORDER BY o.created_at DESC;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows;
};

const findAll = async () => {
  const query = `
    SELECT
      o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
      o.holding_until, o.refund_reason, o.created_at, o.updated_at,
      c.name AS category_name,
      u.name AS buyer_name, u.email AS buyer_email,
      e.id AS event_id, e.title AS event_title, e.organizer_id
    FROM orders o
    JOIN ticket_categories c ON c.id = o.category_id
    JOIN events e ON e.id = c.event_id
    JOIN users u ON u.id = o.buyer_id
    ORDER BY o.created_at DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  createOrder,
  findById,
  findByBuyerId,
  findByIdWithDetails,
  findByEventId,
  findAll,
  markPaid,
  markExpired,
  findUnpaidByBuyerAndCategory,
  markExpiredByBuyerAndCategory,
  markRefundedByEventId,
  findPaidOrdersWithPastEvent,
  findHoldingPeriodExpired,
  markHoldingPeriod,
  markReleased,
  overrideStatus,
  countSoldByCategoryIds,
};
