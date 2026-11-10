'use strict';

// Managed Postgres providers (Render included) hand out connection strings that
// carry sslmode=require and serve a certificate signed by their own CA, which
// Node does not trust. Verifying that chain fails with "self-signed certificate".
// Keep the connection encrypted, but do not validate the chain, and remove the
// sslmode parameter so node-postgres does not re-apply its own strict default.
const TLS_MODES = /^(require|prefer|verify-ca|verify-full|no-verify|true|1|on)$/i;

function poolConfig(overrides = {}) {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure your PostgreSQL database.');

  const url = new URL(raw);
  let mode = process.env.PGSSLMODE || '';
  for (const key of ['sslmode', 'ssl']) {
    const value = url.searchParams.get(key);
    if (value) { mode = value; url.searchParams.delete(key); }
  }

  return {
    connectionString: url.toString(),
    ssl: TLS_MODES.test(mode) ? { rejectUnauthorized: false } : false,
    // Without a connect timeout a stuck handshake blocks startup, and on Render
    // that means no port ever opens and the deploy dies on a port scan.
    connectionTimeoutMillis: 10000,
    ...overrides,
  };
}

// Safe to log: host and port only, never credentials.
function describeTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    return `${url.hostname}:${url.port || 5432}${url.searchParams.get('sslmode') ? ' (tls requested)' : ''}`;
  } catch { return 'unparseable DATABASE_URL'; }
}

module.exports = { poolConfig, describeTarget };
