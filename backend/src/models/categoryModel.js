const pool = require("../config/db");

const createCategory = async (eventId, name, price, quota) => {
  const query = `
    INSERT INTO ticket_categories (event_id, name, price, quota)
    VALUES ($1, $2, $3, $4)
    RETURNING id, event_id, name, price, quota, created_at, updated_at;
  `;
  const result = await pool.query(query, [eventId, name, price, quota]);
  return result.rows[0];
};

const findById = async (id) => {
  const query = `
    SELECT id, event_id, name, price, quota, created_at, updated_at
    FROM ticket_categories
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const findByEventId = async (eventId) => {
  const query = `
    SELECT id, event_id, name, price, quota, created_at, updated_at
    FROM ticket_categories
    WHERE event_id = $1
    ORDER BY price ASC;
  `;
  const result = await pool.query(query, [eventId]);
  return result.rows;
};

const updateCategory = async (id, name, price, quota) => {
  const query = `
    UPDATE ticket_categories
    SET name = $2, price = $3, quota = $4
    WHERE id = $1
    RETURNING id, event_id, name, price, quota, created_at, updated_at;
  `;
  const result = await pool.query(query, [id, name, price, quota]);
  return result.rows[0] || null;
};

module.exports = {
  createCategory,
  findById,
  findByEventId,
  updateCategory,
};
