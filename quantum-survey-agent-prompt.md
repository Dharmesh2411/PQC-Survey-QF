# PROMPT FOR AI AGENT: Build "Quadrafort's Quantum Risk Readiness Survey" (fully custom, self-hosted)

Copy everything below the dividing line and give it to your AI agent. Replace the items in [BRACKETS] first.

---

## ROLE AND GOAL

You are a senior full-stack developer. Build a complete, production-ready, fully custom survey website called **"Quadrafort's Quantum Risk Readiness Survey"** for **Quadrafort Technologies** (website: https://www.quadrafort.com/). The company will host and own it. Do not use SurveyMonkey, Google Forms, Typeform or any third-party survey tool. Everything (pages, questions, data, admin) must be built by you in this project.

Use the exact name "Quadrafort's Quantum Risk Readiness Survey" everywhere: page titles, headings, emails, share previews and the admin area. Do not call it "India's First" anywhere.

## TECHNOLOGY RULES (STRICT)

- **Do NOT use TypeScript.** Use plain modern JavaScript (ES2020+) everywhere.
- **Frontend:** plain HTML5, CSS3 and vanilla JavaScript. No React, Vue, Angular, Next.js, Bootstrap, Tailwind or any build step. Write your own CSS (CSS variables, Flexbox, Grid).
- **Backend:** Node.js (LTS version) with Express, written in plain JavaScript using CommonJS (`require`) or ES modules, but be consistent.
- **Database:** PostgreSQL, accessed with the `pg` package and parameterized SQL queries (no ORM). Provide the SQL schema as a `.sql` file and a migration/setup script.
- **Allowed libraries (keep dependencies minimal):** express, pg, helmet, express-rate-limit, express-validator (or hand-written validation), bcrypt, express-session with a PostgreSQL session store (connect-pg-simple), dotenv, csv-stringify, resend or nodemailer for email, compression.
- **Charts in the admin area:** Chart.js loaded from a local file in the project (not a CDN).
- **Fonts:** self-host the same font files the Quadrafort website uses (see Brand and Design). Do not load fonts from Google Fonts or any CDN.
- Keep the folder structure simple and explain it in the README.

## BRAND AND DESIGN: MATCH THE QUADRAFORT WEBSITE EXACTLY

The survey must look and feel like a natural part of https://www.quadrafort.com/ (same company, same visual identity). A visitor should not be able to tell it is a separate application.

**Step 1: study the live website first.** Open https://www.quadrafort.com/ (and a couple of inner pages such as https://www.quadrafort.com/pages/post-quantum-cryptography and https://www.quadrafort.com/pages/contactus) in a browser and inspect the real HTML and CSS. Extract and reproduce exactly:
- the font families, weights and sizes (headings, body, buttons, nav)
- the full color palette in exact hex values (backgrounds, text, primary and accent colors, button colors and hover colors, borders, card backgrounds, footer background)
- spacing, container width, border radius, shadows, button shapes and hover or transition effects, and scroll or reveal animations
- icon styles and image treatment

Save these as CSS variables in one file (`public/css/design-tokens.css`) and build everything from those tokens. Do not guess or invent colors or fonts: copy them from the live site. If anything cannot be determined, use [PRIMARY COLOR], [SECONDARY COLOR] and [FONT NAME] that I will provide.

**Step 2: logo and assets.** Download the official logo from the website and save it locally in the project (do not hotlink it to the live site):
- Logo: https://www.quadrafort.com/assets/imgs/quadrafort_logo.f10dc500.png
- Favicon: https://test-qf.netlify.app/assets/qfimgs/qf-fav-icon.png (if this is unavailable, take the favicon declared in the live site's `<head>`)
- Social icons used in the footer (LinkedIn, Facebook, Twitter/X, Instagram) from https://www.quadrafort.com/assets/qfimgs/ (for example `linkedin.png`)
Use the logo as-is: do not recolor, stretch or redraw it. Check if a light or dark version is needed for the background it sits on and take it from the site rather than editing it.

**Step 3: reuse the website's layout patterns.** The Quadrafort homepage is built from these patterns, so reuse them for the survey pages:
- **Header:** logo on the left; the same main navigation as the site (Home, Who we are, What we do, Insights, Technologies, GCC, PQC, Career, Contact) with the same dropdown behaviour; every link points to the full https://www.quadrafort.com/... URL. Responsive mobile menu (hamburger). Keep the header simple on the survey screens themselves (logo, progress, and an exit link) so people stay focused.
- **Cookie banner:** a "Your Privacy" cookie notice with Accept and Reject buttons, styled like the website's, linking to https://www.quadrafort.com/pages/cookie-policy. Do not load analytics until the visitor accepts.
- **Hero:** a large headline, a short supporting paragraph, and two buttons (a filled primary button and a secondary button), in the same style as the homepage hero ("Start your transformation" and "See what we do" are the website's equivalents; ours are "Start the Survey" and "Why this matters").
- **Section headings:** small uppercase label (eyebrow) above a large heading, for example "WHY THIS MATTERS", "WHAT YOU GET", "BY THE NUMBERS", just like "WAYS WE SERVE" and "WHY QUADRAFORT" on the site.
- **Numbered cards:** cards numbered 01, 02, 03 with a title and short description, like the "Ways we serve" and "Core Differentiators" sections.
- **Stats and trust strip:** the website's "Milestones & Metrics" style: 100+ enterprise customers served worldwide, 500+ IT professionals, CMMi Level 3 and SOC 2 Type 2 certification, and ISO 9001, 14001, 20001, 27001 and 31000 certifications. Use the website's icons for these (taken from https://www.quadrafort.com/assets/qfimgs/milestone_rv1.svg and the others in that series). Confirm figures against the live site before publishing.
- **Closing call to action:** like "GET IN TOUCH: Let's build what's next." with a Contact us button.
- **Footer:** the same multi-column footer as the website (logo; Industries; Services; Assets; Insights; Connect with us), the social icons, the contact email and phone numbers shown in the website footer (+91 120-699-3088 and +1 415-967-2950), links to the Privacy notice (https://www.quadrafort.com/pages/privacy-notice), Cookie policy (https://www.quadrafort.com/pages/cookie-policy) and Disclaimer (https://www.quadrafort.com/pages/disclaimer), and the line "© Quadrafort Technologies Limited. All Rights Reserved." Copy the footer link list from the live site so it stays identical.
- **Forms:** style inputs, dropdowns, checkboxes and buttons like the website's "Connect with us" contact form (labels, field style, validation and error look).

**Survey screens:** the question screens must still feel like Quadrafort (same fonts, colors, buttons and card style) while being clean and distraction-free: one question per screen, a progress bar in the brand accent color, and generous spacing.

**Quality bar for all pages:**
- Mobile-first and fully responsive. Most visitors will open the link on a phone from LinkedIn or WhatsApp.
- Accessibility: WCAG 2.1 AA contrast, full keyboard navigation, visible focus states, proper labels, ARIA for the progress bar and errors, and respect for `prefers-reduced-motion`.
- Fast: compress images (WebP where possible), lazy-load below the fold, aim for a Lighthouse score above 90.
- Quantum theme: only a subtle touch (for example a quiet animated background or a small decorative graphic in the hero) that fits Quadrafort's existing style. Do not change the website's look to add it.

## PAGES TO BUILD

1. **Landing page (`/`)**
   - Hero: title "Quadrafort's Quantum Risk Readiness Survey", one-line promise, and a prominent "Start the Survey" button.
   - "Why this matters" section (3 short points: quantum computers may break today's public-key cryptography; "harvest now, decrypt later" attacks; migration to post-quantum cryptography takes years).
   - "What you get": [BENEFIT, e.g. free benchmark report, personal readiness score, early insights].
   - Time to complete (about [X] minutes), confidentiality note, and who is running the survey (Quadrafort Technologies, with a link to https://www.quadrafort.com/pages/post-quantum-cryptography for the company's PQC services).
   - Trust strip and footer as described under Brand and Design.
2. **Survey page (`/survey`)**
   - One question (or one small group of questions) per screen, with a progress bar and a section name.
   - Back and Next buttons, required-question validation with clear messages.
   - Answers auto-saved in the browser (localStorage) so a refresh or accidental close does not lose progress. Offer "Resume where you left off".
   - Conditional logic (show or skip questions based on earlier answers), defined in the data file.
3. **Consent and contact step (last step of the survey)**
   - Consent checkbox (required, unticked by default) linking to the privacy notice.
   - Optional fields: name, work email, organization, designation, phone. Optional checkbox: "Send me the results report."
   - Optional (switchable in config): email verification with a one-time code, in the same way the "Connect with us" form on quadrafort.com verifies emails with an OTP.
4. **Results/Thank-you page (`/thank-you`)**
   - Thank-you message, the participant's readiness score and level (see Scoring), 2 or 3 tailored next-step suggestions based on their weakest section, a button to talk to Quadrafort (https://www.quadrafort.com/pages/contactus), and share buttons for LinkedIn, WhatsApp and copy-link.
5. **Privacy page (`/privacy`)** with editable text covering what is collected, why, retention period, and how to request access or deletion. Also link to the main Quadrafort privacy notice.
6. **Admin area (`/admin`)**, password-protected (see Admin), styled with the same brand tokens.
7. **404 and error pages**, styled to match the website.

## QUESTIONS (store ALL of them in one file: `data/questions.js`)

Make the question file the single source of truth, so questions can be added, removed or reworded without touching other code. Each question object should have: `id`, `section`, `type` (single, multi, scale, dropdown, text), `text`, `helpText` (optional), `options` (each with `value`, `label`, `score`), `required`, `showIf` (optional condition), and `maxSelections` (for multi).

### Section A: About your organization
- A1. Which sector does your organization operate in? (dropdown: Banking and Financial Services, Insurance, Capital Markets, Fintech and Payments, Telecom, Government and Public Sector, Defence and Aerospace, Healthcare, IT and IT Services, Manufacturing, Energy and Utilities, Retail and E-commerce, Education and Research, Other)
- A2. How many employees does your organization have? (single: 1-50, 51-200, 201-1,000, 1,001-5,000, 5,000+)
- A3. Which best describes your role? (single: CISO or Head of Security, CIO or CTO, Risk or Compliance Head, IT or Security Manager, Architect or Engineer, Board or CXO, Consultant, Other)
- A4. Which regulators or frameworks apply to your organization? (multi: RBI, SEBI, IRDAI, TRAI or DoT, CERT-In directions, DPDP Act, PCI DSS, ISO 27001, Other, None)
- A5. Do you operate or handle data across multiple countries? (single: India only, India plus a few countries, Global)

### Section B: Awareness of the quantum threat
- B1. How familiar are you with the threat quantum computing poses to current cryptography? (scale 1 to 5)
- B2. Have you heard of "harvest now, decrypt later" attacks? (single: Yes and understand it well, Heard of it, No)
- B3. How aware are you of the NIST post-quantum cryptography standards (ML-KEM, ML-DSA, SLH-DSA)? (scale 1 to 5)
- B4. When do you think a quantum computer capable of breaking widely used public-key cryptography will exist? (single: Within 5 years, 5-10 years, 10-20 years, More than 20 years, Never, Not sure)

### Section C: Governance and ownership
- C1. Has quantum risk been discussed at board or senior leadership level? (single: Yes regularly, Yes once, No, Not sure)
- C2. Does a named person or team own quantum or post-quantum readiness? (single: Yes, formally; Informally; No)
- C3. Is quantum risk included in your enterprise risk register? (single: Yes, Planned, No, Not sure)
- C4. Has budget been allocated for post-quantum readiness? (single: Yes approved, Under discussion, No, Not sure)

### Section D: Cryptographic visibility
- D1. Do you have an inventory of the cryptographic assets you use (algorithms, keys, certificates, libraries)? (single: Complete and automated, Partial or manual, No, Not sure)
- D2. Where is public-key cryptography used in your environment? (multi: TLS/HTTPS, VPN, PKI and certificates, Code signing, Databases and storage encryption, HSMs, Payments and cards, IoT and OT devices, Email and messaging, Cloud KMS, Mobile apps, Not sure)
- D3. Do you hold data that must stay confidential for 10 years or more? (single: Yes, significant amounts; Some; No; Not sure)
- D4. How well do you know which vendors, SaaS and third parties in your supply chain use cryptography that will need to change? (scale 1 to 5)
- D5. How much legacy or hard-to-update technology (old systems, embedded devices, hardware) do you run? (single: Very little, Some, A lot, Not sure)

### Section E: Readiness and action
- E1. How crypto-agile are your systems (can you change algorithms without major redesign)? (scale 1 to 5)
- E2. What is your current stage of post-quantum migration? (single: Not started, Learning and awareness, Assessment or inventory underway, Pilot or proof of concept, Migration in progress, Largely complete)
- E3. Do you have a documented post-quantum migration roadmap with timelines? (single: Yes approved, Draft, No)
- E4. Have you asked your vendors and cloud providers about their post-quantum plans? (single: Yes all key vendors, Some, No)
- E5. Are you testing hybrid or post-quantum algorithms anywhere? (single: Yes in production, Yes in testing, Planning, No)
- E6. By when does your organization plan to complete migration of critical systems? (single: Before 2030, 2030-2033, After 2033, No plan yet)

### Section F: Barriers and needs
- F1. What are your biggest challenges? Choose up to 3. (multi, max 3: Lack of awareness at leadership level, Lack of skilled people, Budget, Unclear regulatory guidance in India, Not enough vendor support, Legacy systems, Performance and compatibility concerns, Unclear business case, Competing priorities)
- F2. What help would be most useful? Choose up to 3. (multi, max 3: Cryptographic inventory and discovery, Risk assessment and roadmap, Training and awareness, Vendor assessment, Proof of concept and testing, Regulatory guidance, Benchmarking against peers)
- F3. How would you describe your overall confidence in your organization's quantum readiness? (scale 1 to 5)
- F4. Anything else you would like to share? (text, optional, max 1000 characters)

Then the consent and contact step (see Pages).

## SCORING (READINESS SCORE)

- Give every scored option a 0-4 score in `questions.js`. Sections B, C, D, E count toward the score. Sections A and F do not (profile and needs only).
- Calculate a score out of 100, plus a score per section, **on the server** (never trust the browser).
- Levels: 0-25 "Beginner", 26-50 "Developing", 51-75 "Progressing", 76-100 "Advanced". Keep the thresholds in a config file.
- Questions answered "Not sure" score 0. Skipped conditional questions are excluded from the maximum.
- Show on the results page: overall score, level, a bar per section, and the strongest and weakest section.

## DATABASE

Tables (PostgreSQL): `respondents` (id UUID, created_at, consent_given, consent_timestamp, name, email, organization, designation, phone, wants_report, ip_hash, user_agent, source/utm fields, completed boolean), `answers` (id, respondent_id, question_id, value stored as JSON text), `scores` (respondent_id, total, level, per-section scores as JSON), `admin_users`, and the session table. Add indexes on `respondent_id` and `created_at`. Provide `schema.sql` and a `npm run setup` script.

## API

- `POST /api/submit`: receives all answers and contact details, validates every answer against `questions.js` on the server (allowed values, required, max selections, text length), calculates the score, saves everything in one database transaction, and returns the score. Reject bad data with clear errors.
- `GET /api/questions`: returns the question set to the frontend (without scoring values).
- Admin endpoints for stats, response list, single response, and CSV export (all require login).
- Prevent duplicate submissions (a one-time submission token, plus an email check if an email is given).

## ADMIN AREA

- Login with username and password (bcrypt hashed), secure session cookie (httpOnly, secure, sameSite), login rate limiting and lockout after repeated failures.
- Dashboard: total visits, started, completed, completion rate; responses over time; average readiness score; breakdown by sector, company size and role.
- Per-question charts (Chart.js) with the option to filter by sector and date range.
- Responses table with search, filters, pagination and a detail view.
- **Export to CSV** (all responses, one row per respondent, one column per question).
- Button to delete a respondent's data (for DPDP deletion requests), with a confirmation and an audit log.
- Admin user created from the command line (`npm run create-admin`), never hard-coded.

## EMAIL

- On completion, send the participant a thank-you email with their score (only if they gave an email), branded with the Quadrafort logo and colors. Use Resend or SMTP, with credentials from environment variables.
- Send [ADMIN EMAIL] a notification for each completed response (can be switched off in config).

## SECURITY AND PRIVACY (DPDP ACT, INDIA)

- HTTPS only, HSTS, `helmet` with a strict Content Security Policy, CSRF protection for admin forms, escape all output (prevent XSS), parameterized queries only (prevent SQL injection).
- Rate limiting on all API routes; bot protection with Cloudflare Turnstile on submit.
- Consent must be explicit and recorded with a timestamp. Contact fields are optional.
- Store an IP hash, not the raw IP.
- Encrypt backups. Hosting and database in an Indian region (for example AWS Mumbai or similar).
- Data retention setting in config, and a documented process for access and deletion requests.
- Never log personal data. Keep all secrets (database URL, session secret, email key, Turnstile key) in a `.env` file, with a `.env.example` provided. Never commit secrets.

## SHARING AND ANALYTICS

- Open Graph and Twitter Card tags with a good preview image (1200x630, in the Quadrafort style with the logo) and the title "Quadrafort's Quantum Risk Readiness Survey" so the link looks right on LinkedIn and WhatsApp.
- Privacy-friendly analytics (self-hosted or Plausible), loaded only after cookie consent; capture UTM parameters into `respondents` so I can see which campaign each response came from.
- `sitemap.xml`, `robots.txt` (block `/admin`), favicon and meta descriptions.

## DEPLOYMENT

- Provide a deployment guide for a Linux VPS: Node.js with PM2 or systemd, Nginx as reverse proxy, free HTTPS with Let's Encrypt, firewall, and the domain [DOMAIN, e.g. survey.quadrafort.com].
- Daily automatic PostgreSQL backups with retention, and a restore guide.
- Provide a health check endpoint (`/health`) and basic error logging to files.

## PROJECT STRUCTURE (suggested)

```
/public      (HTML, CSS incl. design-tokens.css, client JS, fonts, images, logo, Chart.js)
/data        (questions.js, scoring config)
/server      (app.js, routes, middleware, db, email)
/db          (schema.sql, setup script)
/scripts     (create-admin, backup)
.env.example
README.md
```

## HOW TO WORK

1. Build in stages and test each one before moving on: (1) project setup and database, (2) design tokens and shared header/footer copied from the live Quadrafort site, (3) landing page, (4) survey UI with questions from `questions.js`, (5) server, validation, scoring and saving, (6) results page and email, (7) admin area, (8) security hardening, (9) deployment guide.
2. After each stage, tell me what was built and how to run it, and show screenshots at phone and desktop width next to the matching Quadrafort page so I can compare the look.
3. Write the code with clear comments and consistent naming. Do not leave placeholders or TODOs in finished code.
4. Add automated tests for the scoring function and the validation (using Node's built-in test runner).
5. At the end, deliver a README covering setup, environment variables, running locally, adding or editing questions, creating the admin user, deploying, backups and troubleshooting.

## ACCEPTANCE CHECKLIST (all must pass before you say you are done)

- [ ] No TypeScript anywhere, and no frontend framework or build step
- [ ] The name is "Quadrafort's Quantum Risk Readiness Survey" on every page, email and share preview
- [ ] The logo, fonts, colors, header, footer and cookie banner match https://www.quadrafort.com/ (tokens copied from the live site, not guessed)
- [ ] A full survey can be completed on a phone and on desktop, and refreshing mid-survey does not lose answers
- [ ] Server rejects tampered or invalid answers, and the score is calculated only on the server
- [ ] Responses appear in the admin dashboard and export correctly to CSV
- [ ] Consent is required and recorded, and deletion works from the admin area
- [ ] Open Graph preview works, and Lighthouse performance and accessibility scores are above 90
- [ ] Fresh install works by following only the README
