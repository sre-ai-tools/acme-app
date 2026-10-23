-- At most one postmortem per incident (APP-3).
BEGIN;

CREATE TABLE postmortems (
  incident_id uuid        PRIMARY KEY REFERENCES incidents (id) ON DELETE CASCADE,
  summary     text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 20000),
  impact      text        NOT NULL CHECK (char_length(impact) BETWEEN 1 AND 20000),
  root_cause  text        NOT NULL CHECK (char_length(root_cause) BETWEEN 1 AND 20000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER postmortems_set_updated_at
  BEFORE UPDATE ON postmortems
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
