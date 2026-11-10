# Quadrafort's Quantum Risk Readiness Survey

A fully custom, self-hosted survey for Quadrafort Technologies. It uses plain HTML, CSS and browser JavaScript; an Express server written in CommonJS; and PostgreSQL through parameterized `pg` queries. There is no frontend framework or compilation step.

The visual tokens in `public/css/design-tokens.css` reflect the publicly rendered Quadrafort website checked during implementation: Lato typography, a near-black interface and the pink `#d73465` action color. The official logo and social images are served locally from `public/img/`. The public site has changed over time; trust copy here uses its currently displayed 100+ enterprise customers and 600+ IT professionals.

The survey itself is a single scrollable page: every question is presented top to bottom in its section, progress is saved in the browser as the respondent answers, consent is collected at the end of the same page, and the PQC Readiness Assessment is rendered there once the server accepts the submission.

## Project layout

- `public/` — static pages, custom CSS, browser scripts and local imagery.
- `data/questions.js` — the complete question catalogue and scored options.
- `data/scoring.js` — readiness sections, level bands, retention and notification defaults.
- `server/` — Express routes, validation/scoring and optional email delivery.
- `db/schema.sql` — PostgreSQL schema; `db/setup.js` applies it idempotently.
- `scripts/` — command-line admin creation and encrypted database backup.
- `test/` — Node built-in unit tests.

## Requirements

- Node.js 20 or later (Node.js 24 was used for local syntax and tests).
- PostgreSQL 14 or later, with `pgcrypto` available (the extension is commonly available in standard PostgreSQL installs).
- `pg_dump` and `pg_restore` from a PostgreSQL client package for backups/restores.
- Linux VPS with Nginx/PM2 or systemd for production.

## Run locally

1. Install dependencies: `npm install`.
2. Create a local PostgreSQL database, for example `createdb quadrafort_survey`.
3. Copy `.env.example` to `.env`, set `DATABASE_URL`, and set separate random values for `SESSION_SECRET` and `IP_HASH_SECRET` (each at least 32 characters). For example, generate each using `openssl rand -hex 32`.
4. Apply the database schema: `npm run setup`.
5. Start the server: `npm run dev` (or `npm start`). Open `http://localhost:3000`.
6. Add an administrator: `npm run create-admin`. This prompts for a username/password; passwords must contain at least 12 characters and are stored using bcrypt.
7. Run tests with `npm test`. Check health with `curl http://localhost:3000/health`.

### Running without a system PostgreSQL (local development)

If PostgreSQL is not installed on the machine, the workspace can use the project-local cluster in `.localpg/` (PostgreSQL 17 Windows binaries plus its own `package.json`; it is deliberately not a dependency of the app). Its data directory is `.localpg/data`, which is git-ignored.

1. Start it and leave the terminal open: `cd .localpg && ./node_modules/@embedded-postgres/windows-x64/native/bin/postgres.exe -D ./data -p 5433 -c listen_addresses=127.0.0.1`
2. Point `.env` at it: `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/quadrafort_survey` (loopback only, trust authentication for local development).
3. Then follow `npm run setup` and `npm start` as usual. If `.localpg/data` does not exist yet, create it first with `initdb -D ./data -U postgres --auth=trust --encoding=UTF8 --locale=C` from `.localpg/node_modules/@embedded-postgres/windows-x64/native/bin/`.

For production, use a real managed or self-hosted PostgreSQL as described above instead of this local cluster.

The server deliberately refuses to start without strong session and IP-hashing secrets. In production set `NODE_ENV=production`, use an `https://` `PUBLIC_ORIGIN`, and terminate TLS at a trusted reverse proxy; Express then enables secure cookies and HSTS.

## Configuration

See `.env.example` for every supported value:

- `DATABASE_URL` — PostgreSQL connection URL. Set `PGSSLMODE=require` when the database requires TLS.
- `PG_POOL_MAX` — maximum pooled PostgreSQL connections (default 10).
- `PUBLIC_ORIGIN` — canonical origin, e.g. `https://survey.example.com`; use loopback origin in local development. Mutating requests with a mismatched `Origin` are rejected.
- `SESSION_SECRET`, `IP_HASH_SECRET` — independent random secrets; keep them only in the server's environment file/secret manager.
- `ADMIN_EMAIL`, `NOTIFY_ADMIN` — notification recipient and explicit enable switch. Notifications are off by default.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — optional SMTP delivery. With credentials unset, the survey still completes without email.
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_REQUIRED` — optional Cloudflare Turnstile. Set both keys and `TURNSTILE_REQUIRED=true` to render the locally integrated widget and enforce server-side verification; the server also requires a valid `PUBLIC_ORIGIN`. Site verification is not enabled until the operator configures real keys and hostname in Cloudflare.
- `DATA_RETENTION_DAYS` — default 730-day retention target; operators must schedule deletion in accordance with their published policy.
- `BACKUP_DIR`, `BACKUP_RETENTION_DAYS`, `BACKUP_ENCRYPTION_KEY` — encrypted backup settings. Generate the 32-byte key using `openssl rand -hex 32` and store it outside the application host where possible.
- `EMAIL_VERIFICATION_ENABLED` is reserved for a future OTP flow; verification is not currently implemented and this value does not enable it.
- An emailed results report uses a random 256-bit URL token; only its SHA-256 hash is stored in PostgreSQL. Store the full report URL as confidential, since anyone holding it can view that score.

No analytics script is included. The cookie preference is saved locally and in the essential server session; visit and survey-start counts are recorded only after the visitor accepts. The secure session cookie and one-time survey token are essential to session integrity and submission security, not optional analytics.

## Edit survey questions

Edit `data/questions.js`. Keep IDs unique and use the question types `single`, `multi`, `scale`, `dropdown`, or `text`. Options have `value`, `label`, and `score`. For sections B–E, scores are 0–4; profile (A) and barriers/needs (F) do not contribute. A scale maps 1–5 to 0–4. A question with `required: false` may be skipped. Multi-select questions set `maxSelections`. `showIf` is supported by the survey renderer and validator using `{ questionId, value }`.

`server/survey.js` validates all choices and calculates scores on the server. The overall score averages the normalized score percentages for the applicable B–E sections. A section with no scored answer is excluded. Results report the strongest and weakest scored section.

## Admin

Visit `/admin`, then sign in with an account created by `npm run create-admin`. Re-running the command for an existing username rotates that password and clears lockout state. Accounts lock for 15 minutes after five failed password checks; the login endpoint is also rate-limited. Sessions are PostgreSQL-backed, HTTP-only, SameSite=Lax, and Secure in production. State-changing admin requests require a same-origin request and a session CSRF token.

The dashboard includes visit/start/completion counts, completion rate, average score, responses over time, search, sector/date filters, pagination, respondent details, CSV export and confirmed deletion. Deletion cascades to contact information, answers and score; a separate audit row records the respondent UUID and admin ID without preserving the response contents. CSV values are formula-escaped.

## Privacy and operations

Consent is unticked by default, optional and recorded with its timestamp; a response can be submitted with or without it. Contact details are optional; a results email requires an email address. Network addresses are keyed-hashed with `IP_HASH_SECRET`; raw addresses are not stored. User-agent and responses are stored for survey operations. Never log response or contact values. Application errors are written without PII to `logs/error.log` by default. Access/deletion requests can be submitted through the contact information on `/privacy` and processed from the admin dashboard.

The privacy copy is an operational template, not legal advice. Before public launch, Quadrafort must review it, choose the actual processor/retention policy, add verified controller/rights-request contact details, and ensure Indian-region hosting and backup locations match policy. Restrict access to `.env`, database credentials, backups and logs.

## Deploy on Render

`render.yaml` is a Render Blueprint that creates one Node web service (`post-quantum-readiness-survey`) and one PostgreSQL database (`quadrafort_survey`).

1. Push this repository to GitHub.
2. In the Render dashboard choose **New → Blueprint**, connect the repository and apply it. Render generates `SESSION_SECRET` and `IP_HASH_SECRET`, wires `DATABASE_URL` from the new database, builds with `npm ci`, and runs `node db/setup.js && node server/app.js` on start, so the schema is applied on every boot.

   Do not set `PGSSLMODE` for Render's internal `DATABASE_URL`: the private connection is not TLS, and forcing SSL makes both `db/setup.js` and the server fail with `The server does not support SSL connections`. Set it only when the database is reached over the public internet, where TLS is required.
3. `NODE_ENV=production` is set, and `PUBLIC_ORIGIN` falls back to Render's `RENDER_EXTERNAL_URL`, so the `onrender.com` address works without extra configuration. To serve a custom domain, add it in Render and set `PUBLIC_ORIGIN` to that `https://` origin (same-origin checks and email links depend on it).
4. Create the administrator after the first deploy: open a Render shell and run `npm run create-admin`.

Free Render services spin down after 15 minutes of inactivity (the first request after that takes about a minute), and **free Render Postgres expires 30 days after creation** and is deleted 14 days after that unless upgraded. For a survey that will stay live, upgrade the database to a paid instance or point `DATABASE_URL` at durable PostgreSQL.

## Deploy on an Ubuntu Linux VPS

1. Provision the VPS, domain and PostgreSQL database in an India region as required by company policy. Restrict PostgreSQL network access to the application host/private network. Set DNS for the selected domain (for example `survey.example.com`).
2. Install a supported Node.js LTS release, PostgreSQL client tools (`pg_dump`, `pg_restore`), Nginx, Certbot and PM2. Create an unprivileged system account and application directory.
3. Copy the project and lockfile to the host. Run `npm ci --omit=dev` (create/commit `package-lock.json` in the deployment environment after `npm install`), configure a protected `.env` file (`chmod 600`), then run `npm run setup` and `npm run create-admin`.
4. Set `NODE_ENV=production`, `PUBLIC_ORIGIN=https://<your-domain>`, PostgreSQL SSL settings as needed, random secrets and SMTP/Turnstile secrets if enabled. Configure a process manager with automatic restart and log rotation, or use systemd with a dedicated service account. Bind the app behind Nginx; the app listens on `0.0.0.0` at `PORT` (default 3000).
5. Configure Nginx to proxy to `127.0.0.1:3000`, preserve the `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` headers, serve only TLS on the public origin, redirect HTTP to HTTPS, set request size limits, and never expose `.env`, backups, logs, or database ports. Issue and renew a Let's Encrypt certificate with Certbot. Allow only SSH and HTTP(S) through the firewall; limit SSH to trusted networks where possible.
6. Verify `/health`, complete a test response, review admin access/CSV and deletion behavior, and verify email/Turnstile with their real credentials. Configure backup cron and test restore before collecting production responses.

Example Nginx location (adapt domain, TLS paths and operational policy):

```nginx
server {
    listen 80;
    server_name survey.example.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name survey.example.com;
    # ssl_certificate and ssl_certificate_key are managed by Certbot.
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Firewall and package installation commands depend on the VPS provider; apply the provider's current hardening guidance rather than copying commands without review.

## Encrypted daily backups and restore

Set `BACKUP_ENCRYPTION_KEY` to a 64-hex-character key (`openssl rand -hex 32`), choose a private `BACKUP_DIR`, and run `npm run backup` daily. It invokes `pg_dump`, encrypts the dump with AES-256-GCM, sets the file mode to 0600, and prunes encrypted dumps older than `BACKUP_RETENTION_DAYS` (30 by default). Use cron or a systemd timer under the application account, with output directed to an operator-only log. Copy encrypted backups to a separate, access-controlled storage location; retain the encryption key separately from the backup files.

Restore: stop writes to the app, decrypt a `.dump.enc` file using the same key and format (header `QFS1`, then 12-byte IV, 16-byte GCM auth tag, then ciphertext), verify GCM authentication, write the verified plaintext custom dump to a protected temporary file, and run `pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" <dump-file>`. Restart the app and verify `/health`, records, and admin login. Never restore an untrusted dump or place decrypted backups in a web-served directory.

## Troubleshooting

- `SESSION_SECRET must be set` — set strong independent secrets in `.env`.
- Database unavailable — confirm PostgreSQL is running/reachable, database exists, and `DATABASE_URL`/TLS settings are correct; then run `npm run setup`.
- Admin login is unauthorized — run `npm run create-admin` to add/rotate an account; wait for the 15-minute lockout to expire after repeated failures.
- Submission token expired — refresh `/survey` to obtain a new one-time token. The frontend's saved answers remain in local storage.
- Duplicate email — completed responses are unique per non-empty email by default; use the access/deletion process for legitimate corrections.
- No email received — SMTP is optional; verify SMTP host, port, TLS, credentials, sender verification and provider logs. Delivery errors do not disclose contact details in app logs.
- Turnstile rejects submission — ensure the public widget and token field are enabled together with the server secret and accepted hostnames.
- Run `npm test` for scoring and validation tests; check the system manager and Nginx logs for startup/proxy failures. Application error logs intentionally omit request bodies and personal data.
