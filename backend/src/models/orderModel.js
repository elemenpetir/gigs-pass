const pool = require("../config/db");

const ORDER_COLUMNS = `
  id, buyer_id, category_id, status, amount, paid_at, created_at, updated_at
`;

const LIFE_CYCLE_COLUMNS = `
  o.id, o.buyer_id, o.category_id, o.status, o.amount, o.paid_at,
  o.holding_until, o.created_at, o.updated_at, e.organizer_id
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

const findActiveByBuyerAndCategory = async (buyerId, categoryId) => {
  const query = `
    SELECT ${ORDER_COLUMNS}
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
    RETURNING ${ORDER_COLUMNS};
  `;
  const result = await pool.query(query, [buyerId, categoryId]);
  return result.rows;
};

const markRefundTriggeredByEventId = async (eventId, client = pool) => {
  const query = `
    UPDATE orders
    SET status = 'refund_triggered'
    WHERE category_id IN (SELECT id FROM ticket_categories WHERE event_id = $1)
      AND status IN ('pending', 'holding_period')
    RETURNING id, buyer_id, category_id, status, amount, holding_until, created_at, updated_at;
  `;
  const result = await client.query(query, [eventId]);
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

const overrideStatus = async (orderId, status) => {
  const query = `
    UPDATE orders
    SET status = $2
    WHERE id = $1 AND status = 'holding_period'
    RETURNING ${ORDER_COLUMNS}, holding_until;
  `;
  const result = await pool.query(query, [orderId, status]);
  return result.rows[0] || null;
};

module.exports = {
  createOrder,
  findById,
  markPaid,
  markExpired,
  findActiveByBuyerAndCategory,
  markExpiredByBuyerAndCategory,
  markRefundTriggeredByEventId,
  findPaidOrdersWithPastEvent,
  findHoldingPeriodExpired,
  markHoldingPeriod,
  markReleased,
  overrideStatus,
};
