const pool = require("../config/db");

const createUser = async (email, passwordHash, role, fullName) => {
  const query = `
    INSERT INTO users (email, password_hash, role, full_name)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, role, full_name, created_at;
  `;
  const result = await pool.query(query, [email, passwordHash, role, fullName]);
  return result.rows[0];
};

const findByEmail = async (email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows[0] || null;
};

const findById = async (userId) => {
  const query =
    "SELECT id, email, role, full_name, created_at FROM users WHERE id = $1";
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

module.exports = {
  createUser,
  findByEmail,
  findById,
};
