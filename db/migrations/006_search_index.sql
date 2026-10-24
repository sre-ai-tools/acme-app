-- Full-text-ish search over timeline events: trigram index for ILIKE '%term%'.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX incident_events_body_trgm_idx
  ON incident_events USING gin (body gin_trgm_ops);

COMMIT;
