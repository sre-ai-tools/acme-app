-- Trigram index for searching timeline events.
--
-- Built CONCURRENTLY so writes to incident_events continue during the build. That can't run
-- inside a transaction, so this file holds this one statement and no BEGIN/COMMIT: run it as
-- written, not wrapped by a migration runner. IF NOT EXISTS makes a re-run safe; if a build
-- fails part-way, drop the INVALID index it leaves before re-running.
CREATE INDEX CONCURRENTLY IF NOT EXISTS incident_events_body_trgm_idx
  ON incident_events USING gin (body gin_trgm_ops);
