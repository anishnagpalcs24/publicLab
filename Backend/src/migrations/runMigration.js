import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log("Running PostgreSQL schema migrations...");

  const client = await pool.connect();
  try {
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      console.log(`Executing migration file: ${file}`);
      const sqlPath = path.join(__dirname, file);
      const rawSql = fs.readFileSync(sqlPath, "utf-8");

      // Remove comment lines
      const cleanedSql = rawSql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");

      const statements = cleanedSql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await client.query("BEGIN");
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (err) {
          console.error(`Failed on statement in ${file}:\n`, stmt);
          throw err;
        }
      }
      await client.query("COMMIT");
      console.log(`Completed: ${file}`);
    }

    console.log("All migrations executed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
