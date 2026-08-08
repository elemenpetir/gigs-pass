const path = require("path");
require("dotenv").config();
const { runner } = require("node-pg-migrate");

module.exports = async () => {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_TEST is not set. Cannot run integration tests against a real database.",
    );
  }

  await runner({
    databaseUrl,
    dir: path.resolve(__dirname, "../../../migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    count: Infinity,
    log: () => {},
  });
};
