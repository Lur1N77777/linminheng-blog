CREATE TABLE IF NOT EXISTS visitor_uniques (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 1,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS visitor_stats (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO visitor_stats (key, value)
VALUES ('unique_visitors', 0);
