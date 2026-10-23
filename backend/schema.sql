CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, face_cipher TEXT, recovery_hash TEXT, verified BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Additive profile-photo migration; existing sessions and accounts are retained.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_cipher TEXT;

-- Face recognition can be disabled for new accounts; retain existing templates.
ALTER TABLE users ALTER COLUMN face_cipher DROP NOT NULL;

CREATE TABLE IF NOT EXISTS live_rooms (
 id TEXT PRIMARY KEY, pin TEXT NOT NULL UNIQUE, host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category TEXT NOT NULL, questions JSONB NOT NULL, team_mode BOOLEAN NOT NULL DEFAULT FALSE,
 status TEXT NOT NULL DEFAULT 'lobby' CHECK(status IN ('lobby','question','feedback','paused','finished')),
 round_index INTEGER NOT NULL DEFAULT 0, question_ms INTEGER NOT NULL, max_players INTEGER NOT NULL DEFAULT 30,
 deadline BIGINT, pause_remaining BIGINT, paused_stage TEXT,
 created BIGINT NOT NULL, expires BIGINT NOT NULL
);
ALTER TABLE live_rooms ADD COLUMN IF NOT EXISTS max_players INTEGER NOT NULL DEFAULT 30;
CREATE INDEX IF NOT EXISTS live_rooms_host ON live_rooms(host_id,created DESC);
CREATE TABLE IF NOT EXISTS live_players (
 id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, team TEXT, points INTEGER NOT NULL DEFAULT 0,
 joined BIGINT NOT NULL, seen BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS live_players_room ON live_players(room_id);
CREATE UNIQUE INDEX IF NOT EXISTS live_players_name ON live_players(room_id,LOWER(name));
CREATE TABLE IF NOT EXISTS live_answers (
 room_id TEXT NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES live_players(id) ON DELETE CASCADE,
 round_index INTEGER NOT NULL, selected INTEGER NOT NULL, correct BOOLEAN NOT NULL,
 points INTEGER NOT NULL, answered BIGINT NOT NULL,
 PRIMARY KEY(room_id,player_id,round_index)
);
