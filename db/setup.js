'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure your PostgreSQL database.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: true } : undefined });
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema is ready.');
  } finally { await pool.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
