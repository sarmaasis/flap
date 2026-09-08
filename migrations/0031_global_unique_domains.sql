-- Global unique domain names: one Flap workspace owns sending/receiving authority per domain.
-- Previously UNIQUE (user_id, name) allowed two workspaces to claim the same DNS name.

-- Keep the earliest row per lower(name); drop later collisions (rare / should be empty in prod).
DELETE FROM domains
WHERE rowid NOT IN (
  SELECT MIN(rowid) FROM domains GROUP BY lower(name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_name_global
  ON domains (lower(name));
