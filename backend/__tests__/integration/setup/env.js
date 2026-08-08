require("dotenv").config();

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    "DATABASE_URL_TEST is not set. Integration tests require a dedicated test database (Neon branch / Supabase project kedua).",
  );
}

process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
