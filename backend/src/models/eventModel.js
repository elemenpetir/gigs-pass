const pool = require("../config/db");

const createEvent = async (organizerId, title, description, eventDate) => {
  const query = `
    INSERT INTO events (organizer_id, title, description, event_date)
    VALUES ($1, $2, $3, $4)
    RETURNING id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at;
  `;
  const result = await pool.query(query, [organizerId, title, description, eventDate]);
  return result.rows[0];
};

const findById = async (id) => {
  const query =
    "SELECT id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at FROM events WHERE id = $1";
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const findPublished = async () => {
  const query = `
    SELECT id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at
    FROM events
    WHERE status = 'published'
    ORDER BY event_date ASC;
  `;
  const result = await pool.query(query);
  return result.rows;
};

const updateEvent = async (id, title, description, eventDate) => {
  const query = `
    UPDATE events
    SET title = $2, description = $3, event_date = $4
    WHERE id = $1
    RETURNING id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at;
  `;
  const result = await pool.query(query, [id, title, description, eventDate]);
  return result.rows[0] || null;
};

const updateStatus = async (id, status, client = pool) => {
  const query = `
    UPDATE events
    SET status = $2
    WHERE id = $1
    RETURNING id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at;
  `;
  const result = await client.query(query, [id, status]);
  return result.rows[0] || null;
};

const updateImage = async (id, imageUrl) => {
  const query = `
    UPDATE events
    SET image_url = $2
    WHERE id = $1
    RETURNING id, organizer_id, title, description, image_url, event_date, status, created_at, updated_at;
  `;
  const result = await pool.query(query, [id, imageUrl]);
  return result.rows[0] || null;
};

module.exports = {
  createEvent,
  findById,
  findPublished,
  updateEvent,
  updateStatus,
  updateImage,
};
