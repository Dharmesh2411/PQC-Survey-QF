CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_token_hash TEXT NOT NULL UNIQUE,
  result_token_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_given BOOLEAN NOT NULL,
  consent_timestamp TIMESTAMPTZ NOT NULL,
  name TEXT,
  email TEXT,
  organization TEXT,
  designation TEXT,
  phone TEXT,
  wants_report BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT,
  user_agent TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  completed BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS respondents_email_completed_unique ON respondents (LOWER(email)) WHERE email IS NOT NULL AND completed = TRUE;
CREATE INDEX IF NOT EXISTS respondents_created_at_idx ON respondents (created_at DESC);
CREATE INDEX IF NOT EXISTS respondents_completed_idx ON respondents (completed, created_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  id BIGSERIAL PRIMARY KEY,
  respondent_id UUID NOT NULL REFERENCES respondents(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  value JSONB NOT NULL,
  UNIQUE (respondent_id, question_id)
);
CREATE INDEX IF NOT EXISTS answers_respondent_id_idx ON answers (respondent_id);

CREATE TABLE IF NOT EXISTS scores (
  respondent_id UUID PRIMARY KEY REFERENCES respondents(id) ON DELETE CASCADE,
  total SMALLINT NOT NULL CHECK (total BETWEEN 0 AND 100),
  level TEXT NOT NULL,
  per_section JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  failed_attempts SMALLINT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS survey_visits (
  id BIGSERIAL PRIMARY KEY,
  session_hash TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('visit', 'start')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS survey_visits_created_at_idx ON survey_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS survey_visits_session_event_idx ON survey_visits (session_hash, event);

CREATE TABLE IF NOT EXISTS deletion_audit (
  id BIGSERIAL PRIMARY KEY,
  respondent_id UUID NOT NULL,
  admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deletion_audit_deleted_at_idx ON deletion_audit (deleted_at DESC);

-- connect-pg-simple creates its session table automatically on first use.
