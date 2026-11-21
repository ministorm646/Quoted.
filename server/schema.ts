// Created automatically the first time the API runs. Safe to run again.
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_login_at TEXT
)`,
  `CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  answers TEXT NOT NULL DEFAULT '{}',
  ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status, created_at)`,
  `CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT '[3,7,14]',
  template TEXT,
  free_until TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT REFERENCES businesses(id),
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount_pence INTEGER NOT NULL CHECK (amount_pence >= 0),
  description TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN
    ('waiting','following_up','accepted','question','declined','won','lost','paused')),
  followups_sent INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_followup_at TEXT,
  last_sent_at TEXT,
  response_token TEXT NOT NULL UNIQUE,
  first_quote INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_business ON quotes(business_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_due ON quotes(status, next_followup_at)`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_email ON quotes(client_email)`,
  `CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_events_quote ON events(quote_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(type, created_at)`,
  `CREATE TABLE IF NOT EXISTS unsubscribes (
  email TEXT PRIMARY KEY,
  is_global INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login','invite')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_login_tokens_exp ON login_tokens(expires_at)`,
  `CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  credited_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_business_id)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  exp INTEGER NOT NULL
)`,
];
