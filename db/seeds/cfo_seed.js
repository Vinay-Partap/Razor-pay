const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedCfo() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });

  // Exact credentials required by the assignment specs
  const CFO_EMAIL = 'cfo@org.com';
  const CFO_PLAIN_PASSWORD = 'CFO#ORG@April2026';

  try {
    await client.connect();
    console.log("Checking if root user account already exists...");

    const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [CFO_EMAIL]);
    if (checkRes.rowCount > 0) {
      console.log("Notice: Root CFO seed target user configuration already exists. Skipping write.");
      return;
    }

    console.log("Hashing strict credential strings...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(CFO_PLAIN_PASSWORD, salt);

    console.log("Inserting root CFO entry payload...");
    await client.query(
      `INSERT INTO users (name, email, password, role) 
       VALUES ($1, $2, $3, $4)`,
      ['Chief Financial Officer', CFO_EMAIL, hashedPassword, 'CFO']
    );

    console.log(`SUCCESS: Root account seeded cleanly -> ${CFO_EMAIL}`);
  } catch (error) {
    console.error("SEEDING CRITICAL SYSTEM FAILURE:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedCfo();