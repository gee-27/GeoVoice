CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, face_cipher TEXT NOT NULL, recovery_hash TEXT, verified BOOLEAN NOT NULL DEFAULT FALSE,
 created BIGINT NOT NULL, consent_at BIGINT NOT NULL, consent_version TEXT NOT NULL,
 auth_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
 id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('face','full')),
 created BIGINT NOT NULL, seen BIGINT NOT NULL, expires BIGINT NOT NULL,
 auth_version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS quizzes (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category TEXT NOT NULL, questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '[]',
 started BIGINT NOT NULL, expires BIGINT NOT NULL, completed BIGINT
);
CREATE INDEX IF NOT EXISTS quizzes_user_date ON quizzes(user_id,completed DESC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,hits INTEGER NOT NULL,reset_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT INTO metadata(key,value) VALUES ('schema_version','1') ON CONFLICT DO NOTHING;

-- Upgrade existing installations once. Expire old authentication sessions.
DELETE FROM sessions WHERE EXISTS (SELECT 1 FROM metadata WHERE key='schema_version' AND value='1');
ALTER TABLE users DROP COLUMN IF EXISTS phone_cipher;
ALTER TABLE users DROP COLUMN IF EXISTS phone_hash;
ALTER TABLE sessions DROP COLUMN IF EXISTS otp_sid;
ALTER TABLE sessions DROP COLUMN IF EXISTS sms_sent;
ALTER TABLE sessions DROP COLUMN IF EXISTS pending_password;
ALTER TABLE sessions DROP COLUMN IF EXISTS recovery_proof;
ALTER TABLE sessions DROP COLUMN IF EXISTS failures;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_stage_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_stage_check CHECK(stage IN ('face','full'));
UPDATE metadata SET value='2' WHERE key='schema_version';
