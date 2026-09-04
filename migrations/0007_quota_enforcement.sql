-- Quota enforcement: accurate message body storage + monthly outbound send counters.
-- Send volume resets on UTC calendar month (sends_month_key = YYYY-MM).

ALTER TABLE messages ADD COLUMN storage_bytes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users ADD COLUMN sends_this_month INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN sends_month_key TEXT NOT NULL DEFAULT '';

-- Backfill body storage (SQLite LENGTH ≈ chars; new writes use UTF-8 byte length).
UPDATE messages SET storage_bytes =
  LENGTH(text_body) + LENGTH(html_body) + LENGTH(subject)
  + LENGTH(COALESCE(snippet, ''))
  + LENGTH(from_addr) + LENGTH(to_addr)
  + LENGTH(COALESCE(cc_addr, '')) + LENGTH(COALESCE(bcc_addr, ''));
