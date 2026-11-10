'use strict';
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function getKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error('BACKUP_ENCRYPTION_KEY must be a 64-character hex key. Generate one with: openssl rand -hex 32');
  return Buffer.from(raw, 'hex');
}
function databaseConfig() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const url = new URL(process.env.DATABASE_URL);
  return { host: url.hostname, port: url.port || '5432', database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), sslmode: process.env.PGSSLMODE || url.searchParams.get('sslmode') || 'prefer' };
}
function runDump(env) {
  return new Promise((resolve, reject) => {
    const dump = spawn('pg_dump', ['--no-owner', '--no-acl', '--format=custom'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; let stderr = '';
    dump.stdout.on('data', (chunk) => chunks.push(chunk)); dump.stderr.on('data', (chunk) => { stderr += chunk; });
    dump.on('error', reject); dump.on('close', (code) => code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`pg_dump failed with exit code ${code}: ${stderr.slice(-800)}`)));
  });
}
(async () => {
  const key = getKey(); const config = databaseConfig();
  const dir = path.resolve(process.env.BACKUP_DIR || './backups'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dump = await runDump({ ...process.env, ...config, PGPASSWORD: config.password });
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(dir, `quadrafort-survey-${date}.dump.enc`);
  fs.writeFileSync(filename, Buffer.concat([Buffer.from('QFS1'), iv, cipher.getAuthTag(), encrypted]), { mode: 0o600, flag: 'wx' });
  const retentionMs = Number(process.env.BACKUP_RETENTION_DAYS || 30) * 86400000;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^quadrafort-survey-.*\.dump\.enc$/.test(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (Date.now() - fs.statSync(file).mtimeMs > retentionMs) fs.unlinkSync(file);
  }
  console.log(`Encrypted backup created: ${path.basename(filename)}`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
