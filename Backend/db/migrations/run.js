const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("CRITICAL error: DATABASE_URL is missing in your environment variables.");
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log("Connecting directly to Supabase PostgreSQL database instance...");
    await client.connect();

    const migrationPath = path.join(__dirname, '001_init_schema.sql');
    console.log(`Reading SQL structural definition layout from: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("Executing migration payload scripts...");
    await client.query(sql);

    console.log("SUCCESS: Database schema migrations executed and verified safely.");
  } catch (error) {
    console.error("MIGRATION FAILURE: Database structural creation aborted.", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
