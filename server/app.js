'use strict';
require('dotenv').config();
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { stringify } = require('csv-stringify/sync');
const questions = require('../data/questions');
const config = require('../data/scoring');
const { validateAnswers, calculateScore } = require('./survey');
const { sendCompletionEmail } = require('./email');

const app = express();
// Render exposes the service's public URL; use it when PUBLIC_ORIGIN is not set explicitly.
if (!process.env.PUBLIC_ORIGIN && process.env.RENDER_EXTERNAL_URL) process.env.PUBLIC_ORIGIN = process.env.RENDER_EXTERNAL_URL;
const { poolConfig } = require('../db/pool-config');
const pool = new Pool(poolConfig({ max: Number(process.env.PG_POOL_MAX || 10), idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }));
const production = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
const ipSecret = process.env.IP_HASH_SECRET;
if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters.');
if (!ipSecret || ipSecret.length < 32) throw new Error('IP_HASH_SECRET must be set to at least 32 characters.');
if (production && !process.env.PUBLIC_ORIGIN?.startsWith('https://')) throw new Error('PUBLIC_ORIGIN must use HTTPS in production.');
if (process.env.TURNSTILE_REQUIRED === 'true' && (!process.env.TURNSTILE_SECRET_KEY || !process.env.TURNSTILE_SITE_KEY)) throw new Error('TURNSTILE_REQUIRED needs both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.');
if (process.env.TURNSTILE_REQUIRED === 'true' && (!process.env.PUBLIC_ORIGIN || !new URL(process.env.PUBLIC_ORIGIN).hostname)) throw new Error('TURNSTILE_REQUIRED needs a valid PUBLIC_ORIGIN for the widget hostname.');
if (production) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set('view engine', 'none');
app.use(helmet({
  hsts: production ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
    scriptSrc: ["'self'", ...(process.env.TURNSTILE_REQUIRED === 'true' ? ['https://challenges.cloudflare.com'] : [])], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:', ...(process.env.TURNSTILE_REQUIRED === 'true' ? ['https://challenges.cloudflare.com'] : [])], fontSrc: ["'self'"], connectSrc: ["'self'"], frameSrc: process.env.TURNSTILE_REQUIRED === 'true' ? ['https://challenges.cloudflare.com'] : ["'none'"], upgradeInsecureRequests: production ? [] : null,
  } },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(compression());
app.use(express.json({ limit: '48kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true, pruneSessionInterval: 15 * 60 }),
  name: 'qf_survey_session', secret: sessionSecret, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests. Please try again later.' } });
const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many login attempts. Please wait before trying again.' } });
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const expected = process.env.PUBLIC_ORIGIN;
    if (origin && expected && new URL(origin).origin !== new URL(expected).origin) return res.status(403).json({ error: 'Requests from this origin are not allowed.' });
  }
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: production ? '1h' : 0, etag: true, dotfiles: 'deny', setHeaders: (res, filePath) => { if (/\\.(?:html|js|css|svg)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache'); } }));

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashSecret = (value) => crypto.createHmac('sha256', ipSecret).update(value).digest('hex');
const getClientIp = (req) => req.ip || req.socket.remoteAddress || '';
const ensureSubmissionToken = (req, res, next) => {
  if (!req.session.submissionToken) req.session.submissionToken = crypto.randomBytes(32).toString('hex');
  req.session.save((error) => error ? next(error) : res.json({ token: req.session.submissionToken }));
};
function sameOrigin(req) {
  const origin = req.get('origin');
  if (origin) {
    try { return new URL(origin).origin === new URL(process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`).origin; } catch { return false; }
  }
  return req.get('sec-fetch-site') !== 'cross-site';
}
function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: 'Please sign in to continue.' });
  res.set('Cache-Control', 'no-store');
  next();
}
function checkAdminCsrf(req, res, next) {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Requests from this origin are not allowed.' });
  const submitted = req.get('x-csrf-token');
  if (!submitted || !req.session.adminCsrf || submitted.length !== req.session.adminCsrf.length || !crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(req.session.adminCsrf))) return res.status(403).json({ error: 'Your session token has expired. Refresh and try again.' });
  next();
}
async function verifyTurnstile(response, ip) {
  if (process.env.TURNSTILE_REQUIRED !== 'true') return true;
  if (!process.env.TURNSTILE_SECRET_KEY || !response) return false;
  try {
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response, remoteip: ip }) });
    const data = await result.json();
    return data.success === true;
  } catch { return false; }
}
function validContact(contact) {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return false;
  const max = { name: 160, email: 254, organization: 200, designation: 160, phone: 40 };
  for (const [key, limit] of Object.entries(max)) if (contact[key] != null && (typeof contact[key] !== 'string' || contact[key].length > limit)) return false;
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return false;
  return contact.wantsReport === undefined || typeof contact.wantsReport === 'boolean';
}
async function track(req, event) {
  if (req.session.cookieChoice !== 'accept') return;
  if (!req.session.tracked) req.session.tracked = {};
  if (req.session.tracked[event]) return;
  req.session.tracked[event] = true;
  const sessionHash = hashSecret(req.sessionID);
  await pool.query('INSERT INTO survey_visits (session_hash, event) VALUES ($1, $2)', [sessionHash, event]);
  await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
}

// Liveness only: the process is up. Render routes traffic on this, so a database
// outage shows an error in the app instead of leaving the instance unrouted.
app.get('/livez', (_req, res) => res.json({ status: 'ok' }));
app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (error) { res.status(503).json({ status: 'unavailable', database: 'disconnected', reason: String(error.message || error).slice(0, 200) }); }
});
app.post('/api/visit', (req, res, next) => { if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin is invalid.' }); req.session.cookieChoice = 'accept'; track(req, 'visit').then(() => res.json({ tracked: true })).catch(next); });
app.post('/api/cookie-choice', (req, res, next) => { if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin is invalid.' }); if (!['accept', 'reject'].includes(req.body?.choice)) return res.status(400).json({ error: 'Invalid cookie preference.' }); req.session.cookieChoice = req.body.choice; req.session.save((error) => error ? next(error) : res.json({ saved: true })); });
app.get('/api/questions', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(questions.map(({ id, section, type, text, helpText, options, required, showIf, maxSelections, maxLength, allowNone }) => ({ id, section, type, text, helpText, options: options.map(({ value, label }) => ({ value, label })), required, ...(showIf ? { showIf } : {}), ...(maxSelections ? { maxSelections } : {}), ...(maxLength ? { maxLength } : {}), ...(allowNone ? { allowNone } : {}) })));
});
app.post('/api/start', (req, res, next) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin is invalid.' });
  if (req.session.cookieChoice === 'accept') return track(req, 'start').then(() => res.json({ started: true })).catch(next);
  res.json({ started: false });
});
app.get('/api/token', (req, res, next) => {
  if (!req.session.submissionToken) req.session.submissionToken = crypto.randomBytes(32).toString('hex');
  req.session.save((error) => error ? next(error) : res.json({ token: req.session.submissionToken, turnstileSiteKey: process.env.TURNSTILE_REQUIRED === 'true' ? (process.env.TURNSTILE_SITE_KEY || '') : '' }));
});

app.post('/api/submit', submitLimiter, async (req, res, next) => {
  const { answers, contact, consent, submissionToken, turnstileToken } = req.body || {};
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin is invalid.' });
  if (typeof submissionToken !== 'string' || !/^[0-9a-f]{64}$/.test(submissionToken) || !req.session.submissionToken || submissionToken.length !== req.session.submissionToken.length || !crypto.timingSafeEqual(Buffer.from(submissionToken), Buffer.from(req.session.submissionToken))) return res.status(403).json({ error: 'Your submission token has expired. Refresh the survey and try again.' });
  if (typeof consent !== 'boolean') return res.status(400).json({ error: 'Please indicate whether you consent before submitting.' });
  if (!validContact(contact)) return res.status(400).json({ error: 'Please check your contact details and try again.' });
  const validation = validateAnswers(answers);
  if (!validation.valid) return res.status(400).json({ error: 'Please correct the survey responses.', details: validation.errors });
  if (contact.wantsReport && !contact.email) return res.status(400).json({ error: 'An email address is required to send the results report.' });
  if (!(await verifyTurnstile(turnstileToken, getClientIp(req)))) return res.status(400).json({ error: 'Bot verification was not successful. Please refresh and try again.' });
  const score = calculateScore(answers);
  const tokenHash = sha256(submissionToken);
  const resultToken = contact.wantsReport ? crypto.randomBytes(32).toString('hex') : null;
  const resultTokenHash = resultToken ? sha256(resultToken) : null;
  const client = await pool.connect();
  let respondent;
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`INSERT INTO respondents
      (submission_token_hash, result_token_hash, consent_given, consent_timestamp, name, email, organization, designation, phone, wants_report, ip_hash, user_agent, source, utm_source, utm_medium, utm_campaign, utm_term, utm_content, completed)
      VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, TRUE)
      RETURNING id, created_at, email, wants_report`, [tokenHash, resultTokenHash, consent, contact.name || null, contact.email || null, contact.organization || null, contact.designation || null, contact.phone || null, contact.wantsReport === true, hashSecret(getClientIp(req)), String(req.get('user-agent') || '').slice(0, 500), typeof req.body.source === 'string' ? req.body.source.slice(0, 200) : null, ...['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].map((key) => typeof req.body[key] === 'string' ? req.body[key].slice(0, 200) : null)]);
    respondent = inserted.rows[0];
    for (const [questionId, value] of Object.entries(answers)) await client.query('INSERT INTO answers (respondent_id, question_id, value) VALUES ($1, $2, $3::jsonb)', [respondent.id, questionId, JSON.stringify(value)]);
    await client.query('INSERT INTO scores (respondent_id, total, level, per_section) VALUES ($1, $2, $3, $4::jsonb)', [respondent.id, score.total, score.level, JSON.stringify(score.sections)]);
    await client.query('COMMIT');
    req.session.submissionToken = null;
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: error.constraint === 'respondents_email_completed_unique' ? 'A completed survey already exists for this email address.' : 'This survey has already been submitted.' });
    return next(error);
  } finally { client.release(); }
  sendCompletionEmail({ respondent: { ...respondent, result_token: resultToken }, score }).catch(() => {});
  res.status(201).json({ respondentId: respondent.id, score, ...(resultToken ? { resultToken } : {}) });
});

app.get('/api/results/:token', async (req, res, next) => {
  if (!/^[0-9a-f]{64}$/.test(req.params.token)) return res.status(404).json({ error: 'Results not found.' });
  try {
    const found = await pool.query('SELECT s.total, s.level, s.per_section FROM respondents r JOIN scores s ON s.respondent_id=r.id WHERE r.result_token_hash=$1 AND r.wants_report=true', [sha256(req.params.token)]);
    if (!found.rowCount) return res.status(404).json({ error: 'Results not found.' });
    res.set('Cache-Control', 'no-store'); res.json({ score: { total: found.rows[0].total, level: found.rows[0].level, sections: found.rows[0].per_section } });
  } catch (error) { next(error); }
});
app.get('/api/admin/csrf', requireAdmin, (req, res, next) => {
  req.session.adminCsrf ||= crypto.randomBytes(24).toString('hex');
  req.session.save((error) => error ? next(error) : res.json({ csrfToken: req.session.adminCsrf }));
});
app.get('/api/admin/login-token', (req, res, next) => {
  req.session.adminLoginCsrf ||= crypto.randomBytes(24).toString('hex');
  req.session.save((error) => error ? next(error) : res.json({ csrfToken: req.session.adminLoginCsrf }));
});
app.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  try {
    if (!sameOrigin(req)) return res.status(403).json({ error: 'Request origin is invalid.' });
    if (!req.session.adminLoginCsrf || req.get('x-csrf-token') !== req.session.adminLoginCsrf) return res.status(403).json({ error: 'Refresh the login page and try again.' });
    delete req.session.adminLoginCsrf;
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().slice(0, 100) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
    const result = await pool.query('SELECT id, username, password_hash, failed_attempts, locked_until FROM admin_users WHERE username = $1', [username]);
    const user = result.rows[0];
    const now = Date.now();
    if (!user || (user.locked_until && new Date(user.locked_until).getTime() > now) || !(await bcrypt.compare(password, user?.password_hash || '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'))) {
      if (user) {
        const attempts = user.failed_attempts + 1;
        const lock = attempts >= 5 ? new Date(now + 15 * 60 * 1000) : null;
        await pool.query('UPDATE admin_users SET failed_attempts = $1, locked_until = COALESCE($2, locked_until) WHERE id = $3', [attempts, lock, user.id]);
      }
      return res.status(401).json({ error: 'Username or password is incorrect, or the account is temporarily locked.' });
    }
    await pool.query('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1', [user.id]);
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.adminId = user.id;
    req.session.adminUsername = user.username;
    req.session.adminCsrf = crypto.randomBytes(24).toString('hex');
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.json({ user: { username: user.username }, csrfToken: req.session.adminCsrf });
  } catch (error) { next(error); }
});
app.post('/api/admin/logout', requireAdmin, checkAdminCsrf, (req, res, next) => req.session.destroy((error) => error ? next(error) : res.clearCookie('qf_survey_session', { httpOnly: true, secure: production, sameSite: 'lax' }).json({ loggedOut: true })));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'), { headers: { 'Cache-Control': 'no-store' } }));
app.get('/api/admin/stats', requireAdmin, async (req, res, next) => {
  try {
    const [counts, avg, bySector, bySize, byRole, daily] = await Promise.all([
      pool.query(`SELECT (SELECT COUNT(DISTINCT session_hash) FROM survey_visits WHERE event='visit')::int visits, (SELECT COUNT(DISTINCT session_hash) FROM survey_visits WHERE event='start')::int started, (SELECT COUNT(*) FROM respondents WHERE completed)::int completed`),
      pool.query('SELECT ROUND(AVG(total))::int average FROM scores'),
      pool.query(`SELECT a.value #>> '{}' AS label, COUNT(*)::int count FROM answers a JOIN respondents r ON r.id=a.respondent_id WHERE r.completed AND a.question_id='A1' GROUP BY label ORDER BY count DESC LIMIT 12`),
      pool.query(`SELECT a.value #>> '{}' AS label, COUNT(*)::int count FROM answers a JOIN respondents r ON r.id=a.respondent_id WHERE r.completed AND a.question_id='A2' GROUP BY label ORDER BY count DESC`),
      pool.query(`SELECT a.value #>> '{}' AS label, COUNT(*)::int count FROM answers a JOIN respondents r ON r.id=a.respondent_id WHERE r.completed AND a.question_id='A3' GROUP BY label ORDER BY count DESC`),
      pool.query(`SELECT created_at::date day, COUNT(*)::int count FROM respondents WHERE completed AND created_at > NOW()-INTERVAL '30 days' GROUP BY day ORDER BY day`),
    ]);
    const countsRow = counts.rows[0];
    const average = avg.rows[0].average || 0;
    const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : null;
    const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : null;
    const sector = typeof req.query.sector === 'string' && req.query.sector.length <= 100 ? req.query.sector : null;
    const questionBreakdown = await pool.query(`SELECT a.question_id, a.value, COUNT(*)::int count FROM answers a JOIN respondents r ON r.id=a.respondent_id WHERE r.completed AND ($1::date IS NULL OR r.created_at >= $1::date) AND ($2::date IS NULL OR r.created_at < $2::date + INTERVAL '1 day') AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM answers sector_answer WHERE sector_answer.respondent_id=r.id AND sector_answer.question_id='A1' AND sector_answer.value #>> '{}'=$3)) GROUP BY a.question_id, a.value ORDER BY a.question_id`, [from, to, sector]);
    res.json({ ...countsRow, completionRate: countsRow.started ? Math.round(countsRow.completed / countsRow.started * 100) : 0, averageScore: average, bySector: bySector.rows, bySize: bySize.rows, byRole: byRole.rows, daily: daily.rows, questionBreakdown: questionBreakdown.rows });
  } catch (error) { next(error); }
});
app.get('/api/admin/responses', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
    const search = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '';
    const sector = typeof req.query.sector === 'string' ? req.query.sector.slice(0, 100) : '';
    const from = typeof req.query.from === 'string' && /^\d{4}-\d\d-\d\d$/.test(req.query.from) ? req.query.from : null;
    const to = typeof req.query.to === 'string' && /^\d{4}-\d\d-\d\d$/.test(req.query.to) ? req.query.to : null;
    const params = [search ? `%${search}%` : null, sector || null, from, to, limit, (page - 1) * limit];
    const query = await pool.query(`WITH filtered AS (
      SELECT r.id, r.created_at, r.name, r.email, r.organization, r.designation, r.phone, r.wants_report, s.total, s.level,
      (SELECT a.value #>> '{}' FROM answers a WHERE a.respondent_id=r.id AND a.question_id='A1') sector,
      (SELECT a.value #>> '{}' FROM answers a WHERE a.respondent_id=r.id AND a.question_id='A2') company_size,
      (SELECT a.value #>> '{}' FROM answers a WHERE a.respondent_id=r.id AND a.question_id='A3') role
      FROM respondents r JOIN scores s ON s.respondent_id=r.id
      WHERE r.completed AND ($1::text IS NULL OR COALESCE(r.name,'') ILIKE $1 OR COALESCE(r.email,'') ILIKE $1 OR COALESCE(r.organization,'') ILIKE $1) AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM answers a2 WHERE a2.respondent_id=r.id AND a2.question_id='A1' AND a2.value #>> '{}'=$2)) AND ($3::date IS NULL OR r.created_at >= $3::date) AND ($4::date IS NULL OR r.created_at < $4::date + INTERVAL '1 day')
      ), counted AS (SELECT COUNT(*)::int AS total_count FROM filtered)
      SELECT filtered.*, counted.total_count FROM filtered CROSS JOIN counted ORDER BY filtered.created_at DESC LIMIT $5 OFFSET $6`, params);
    res.json({ responses: query.rows, total: query.rows[0]?.total_count || 0, page, limit });
  } catch (error) { next(error); }
});
app.get('/api/admin/responses.csv', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT r.*, s.total, s.level, s.per_section, a.question_id, a.value FROM respondents r JOIN scores s ON s.respondent_id=r.id LEFT JOIN answers a ON a.respondent_id=r.id WHERE r.completed ORDER BY r.created_at DESC`);
    const respondents = new Map();
    for (const row of result.rows) {
      if (!respondents.has(row.id)) respondents.set(row.id, { respondent_id: row.id, created_at: row.created_at.toISOString(), consent_given: row.consent_given, name: row.name, email: row.email, organization: row.organization, designation: row.designation, phone: row.phone, wants_report: row.wants_report, source: row.source, utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign, utm_term: row.utm_term, utm_content: row.utm_content, total: row.total, level: row.level, per_section: JSON.stringify(row.per_section) });
      if (row.question_id) respondents.get(row.id)[row.question_id] = JSON.stringify(row.value);
    }
    const columns = ['respondent_id','created_at','consent_given','name','email','organization','designation','phone','wants_report','source','utm_source','utm_medium','utm_campaign','utm_term','utm_content','total','level','per_section',...questions.map((item) => item.id)];
    const csv = stringify([...respondents.values()], { header: true, columns, escape_formulas: true });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="quadrafort-quantum-risk-survey-responses.csv"', 'Cache-Control': 'no-store' }).send(csv);
  } catch (error) { next(error); }
});
app.get('/api/admin/responses/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid respondent ID.' });
    const respondent = await pool.query('SELECT r.id, r.created_at, r.consent_given, r.consent_timestamp, r.name, r.email, r.organization, r.designation, r.phone, r.wants_report, s.total, s.level, s.per_section FROM respondents r JOIN scores s ON s.respondent_id=r.id WHERE r.id=$1', [req.params.id]);
    if (!respondent.rowCount) return res.status(404).json({ error: 'Response not found.' });
    const answers = await pool.query('SELECT question_id, value FROM answers WHERE respondent_id=$1 ORDER BY question_id', [req.params.id]);
    res.json({ ...respondent.rows[0], answers: answers.rows });
  } catch (error) { next(error); }
});
app.delete('/api/admin/responses/:id', requireAdmin, checkAdminCsrf, async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid respondent ID.' });
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM respondents WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!exists.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Response not found.' }); }
    await client.query('INSERT INTO deletion_audit (respondent_id, admin_user_id) VALUES ($1,$2)', [req.params.id, req.session.adminId]);
    await client.query('DELETE FROM respondents WHERE id=$1', [req.params.id]);
    await client.query('COMMIT'); res.json({ deleted: true });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
});

app.get('/survey', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'survey.html')));
app.get('/thank-you', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'thank-you.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api/admin\nAllow: /\nSitemap: /sitemap.xml\n'));
app.get('/sitemap.xml', (req, res) => {
  const origin = (process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/privacy</loc></url></urlset>`);
});
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).sendFile(path.join(__dirname, '..', 'public', '404.html'));
});
app.use((error, req, res, _next) => {
  const logFile = process.env.ERROR_LOG_FILE || path.join(__dirname, '..', 'logs', 'error.log');
  try { fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.appendFileSync(logFile, `${new Date().toISOString()} ${String(req.method).slice(0, 12)} ${String(error.code || 'ERROR').slice(0, 32)}\n`); } catch { /* Logging must not make an error path fail. */ }
  if (res.headersSent) return;
  const message = error.type === 'entity.too.large' ? 'Request body is too large.' : 'The request could not be completed. Please try again.';
  res.status(error.type === 'entity.too.large' ? 413 : 500).json({ error: message });
});

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Survey server listening on port ${port}`);
    pool.query('SELECT 1')
      .then(() => console.log('Database connection OK.'))
      .catch((error) => console.error(`Database connection FAILED: ${error.code || error.message}`));
  });
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
module.exports = { app, pool };
