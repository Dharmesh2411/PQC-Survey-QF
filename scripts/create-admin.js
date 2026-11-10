'use strict';
require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const cli = readline.createInterface({ input: stdin, output: stdout });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const username = (await cli.question('Admin username: ')).trim();
    const password = await cli.question('Admin password (minimum 12 characters): ');
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username)) throw new Error('Use a username of 3–100 letters, numbers, dots, underscores or hyphens.');
    if (password.length < 12 || password.length > 200) throw new Error('Password must be 12–200 characters.');
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO admin_users (username,password_hash) VALUES ($1,$2) ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash, failed_attempts=0, locked_until=NULL', [username, hash]);
    console.log(`Admin account ${username} is ready.`);
  } finally { cli.close(); await pool.end(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
