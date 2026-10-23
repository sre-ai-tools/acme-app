-- Incidents: one row per incident (APP-1).
BEGIN;

-- Shared by every table with an updated_at column.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE incidents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  severity    smallint    NOT NULL CHECK (severity BETWEEN 1 AND 4),  -- SEV1 (worst) .. SEV4
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'mitigated', 'resolved')),
  started_at  timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT incidents_resolved_after_start CHECK (resolved_at >= started_at),
  -- resolved_at is set exactly when the incident is resolved.
  CONSTRAINT incidents_resolved_at_matches_status
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);

CREATE TRIGGER incidents_set_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keyset pagination for the list, newest first (APP-5): unfiltered, and filtered by status.
CREATE INDEX incidents_started_at_id_idx ON incidents (started_at DESC, id DESC);
CREATE INDEX incidents_status_started_at_id_idx ON incidents (status, started_at DESC, id DESC);

COMMIT;
