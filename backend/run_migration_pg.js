const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const connectionString = 'postgresql://postgres:jXpFqShLFwULrDKn@db.wiwzszumewxnclagfwmj.supabase.co:5432/postgres';

console.log('Connecting to PostgreSQL database...');

const client = new Client({
  connectionString: connectionString
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database successfully.');

    const migrationSql = fs.readFileSync(path.join(__dirname, '../migration_activity_tracking.sql'), 'utf8');
    console.log('Running migration...');
    
    await client.query(migrationSql);
    console.log('Migration ran successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
