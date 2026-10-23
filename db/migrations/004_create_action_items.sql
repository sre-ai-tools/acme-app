-- Follow-up work from an incident (APP-4).
BEGIN;

CREATE TABLE action_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid        NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  description text        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  owner       text        NOT NULL CHECK (char_length(owner) BETWEEN 1 AND 200),
  due_date    date,
  done        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER action_items_set_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Serves the per-incident list and the foreign key's cascade.
CREATE INDEX action_items_incident_id_idx ON action_items (incident_id, created_at, id);

COMMIT;
