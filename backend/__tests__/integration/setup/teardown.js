afterAll(async () => {
  const db = require("../../../src/config/db");
  await db.end().catch(() => {});
});
