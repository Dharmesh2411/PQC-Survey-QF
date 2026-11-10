'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { poolConfig } = require('./pool-config');

const ATTEMPTS = 4;
const RETRY_DELAY_MS = 3000;

(async () => {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const pool = new Pool(poolConfig());
    try {
      await pool.query(schema);
      console.log('Database schema is ready.');
      return;
    } catch (error) {
      // A managed database can be briefly unreachable while it boots, and on
      // Render a failed start command takes the whole service down.
      console.error(`Schema attempt ${attempt}/${ATTEMPTS} failed: ${error.message}`);
      if (attempt === ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    } finally { await pool.end(); }
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
