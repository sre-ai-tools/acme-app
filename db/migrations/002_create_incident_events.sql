-- Timeline events for an incident, shown in time order (APP-2).
BEGIN;

CREATE TABLE incident_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid        NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  kind        text        NOT NULL
                          CHECK (kind IN ('detection', 'action', 'communication', 'note')),
  body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Serves the timeline query and the foreign key's cascade.
CREATE INDEX incident_events_incident_id_occurred_at_idx
  ON incident_events (incident_id, occurred_at, id);

COMMIT;
