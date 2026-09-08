-- Sandbox / test API keys + store webhook delivery payloads for redelivery.

ALTER TABLE api_keys ADD COLUMN mode TEXT NOT NULL DEFAULT 'live'; -- live | test

ALTER TABLE webhook_deliveries ADD COLUMN payload_json TEXT NOT NULL DEFAULT '';
