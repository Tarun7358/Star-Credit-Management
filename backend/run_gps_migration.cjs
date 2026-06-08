const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const client = new Client({
  connectionString: "postgresql://postgres:jXpFqShLFwULrDKn@db.wiwzszumewxnclagfwmj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL");

  const sql = fs.readFileSync(path.join(__dirname, "../migration_gps_visit.sql"), "utf8");

  try {
    await client.query(sql);
    console.log("✅ GPS migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration error:", err.message);
  } finally {
    await client.end();
    console.log("Connection closed.");
  }
}

runMigration();
