const { Pool } = require("pg");
require("dotenv").config();

let ssl = false;
if (process.env.DATABASE_SSL === "true") {
  ssl = { rejectUnauthorized: false };
} else if (process.env.NODE_ENV === "production") {
  ssl = { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl,
});

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

module.exports = pool;
