-- 0002_series_plans: global (cross-project) series/curriculum planning.
-- Episodes live inside the JSON blob rather than as separate rows -- a
-- series plan is edited as a whole document in the Series Planner UI, and
-- episode counts are small (tens, not thousands), so this keeps the schema
-- simple without a real query need for individual episode rows yet.

CREATE TABLE IF NOT EXISTS series_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);
