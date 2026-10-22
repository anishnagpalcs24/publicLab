import pg from "pg";
import config from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

export default async function connectDB() {
  try {
    await pool.query("SELECT 1");
    console.log("Connected to PostgreSQL successfully");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    throw error;
  }
}