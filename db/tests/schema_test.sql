-- Schema tests: constraints, triggers, cascades and a seed re-run.
-- Run against a scratch database with all migrations and the dev seed applied:
--   psql -v ON_ERROR_STOP=1 -f db/tests/schema_test.sql
-- Any failed assertion raises an error. After the seed re-run, everything runs in one
-- transaction and is rolled back.

-- Hide query results; errors and \echo still print.
\o /dev/null

-- Re-running the seed changes nothing. It commits on its own, so this runs before BEGIN.
CREATE TEMP TABLE seed_counts AS
  SELECT (SELECT count(*) FROM incidents) AS incidents,
         (SELECT count(*) FROM incident_events) AS events,
         (SELECT count(*) FROM postmortems) AS postmortems,
         (SELECT count(*) FROM action_items) AS action_items;
SET app.allow_seed = 'on';
\ir ../seed/dev_seed.sql
RESET app.allow_seed;
DO $$
BEGIN
  IF (SELECT row(s.*) FROM seed_counts s) IS DISTINCT FROM
     (SELECT row((SELECT count(*) FROM incidents), (SELECT count(*) FROM incident_events),
                 (SELECT count(*) FROM postmortems), (SELECT count(*) FROM action_items))) THEN
    RAISE EXCEPTION 'seed re-run changed row counts';
  END IF;
END;
$$;

BEGIN;

-- Fails unless stmt raises the expected SQLSTATE.
CREATE FUNCTION pg_temp.assert_rejects(stmt text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RAISE EXCEPTION 'not rejected: %', stmt;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' OR SQLSTATE <> expected THEN
      RAISE EXCEPTION 'expected SQLSTATE % for "%", got %: %', expected, stmt, SQLSTATE, SQLERRM;
    END IF;
END;
$$;

-- 23514 check_violation, 23503 foreign_key_violation, 23505 unique_violation, 23502 not_null_violation
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, started_at) VALUES ('x', 5, now())$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, started_at) VALUES ('', 1, now())$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, status, started_at) VALUES ('x', 1, 'closed', now())$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, status, started_at) VALUES ('x', 1, 'resolved', now())$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, started_at, resolved_at) VALUES ('x', 1, now(), now())$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, status, started_at, resolved_at)
                                VALUES ('x', 1, 'resolved', now(), now() - interval '1 hour')$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity) VALUES ('x', 1)$$, '23502');
SELECT pg_temp.assert_rejects($$INSERT INTO incident_events (incident_id, occurred_at, kind, body)
                                VALUES (gen_random_uuid(), now(), 'note', 'x')$$, '23503');
SELECT pg_temp.assert_rejects($$INSERT INTO incident_events (incident_id, occurred_at, kind, body)
                                VALUES ('00000000-0000-4000-8000-000000000001', now(), 'tweet', 'x')$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO postmortems (incident_id, summary, impact, root_cause)
                                VALUES ('00000000-0000-4000-8000-000000000001', 'a', 'b', 'c')$$, '23505');
SELECT pg_temp.assert_rejects($$INSERT INTO action_items (incident_id, description, owner)
                                VALUES ('00000000-0000-4000-8000-000000000001', 'x', '')$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, started_at, owner)
                                VALUES ('x', 1, now(), '')$$, '23514');
SELECT pg_temp.assert_rejects($$INSERT INTO incidents (title, severity, started_at, owner)
                                VALUES ('x', 1, now(), '   ')$$, '23514');

-- updated_at triggers overwrite any value with the transaction time on update.
DO $$
BEGIN
  UPDATE incidents SET updated_at = '2000-01-01' WHERE id = '00000000-0000-4000-8000-000000000003';
  IF (SELECT updated_at FROM incidents WHERE id = '00000000-0000-4000-8000-000000000003') <> now() THEN
    RAISE EXCEPTION 'incidents.updated_at not set by trigger';
  END IF;
  UPDATE postmortems SET summary = summary || '.' WHERE incident_id = '00000000-0000-4000-8000-000000000001';
  IF (SELECT updated_at FROM postmortems WHERE incident_id = '00000000-0000-4000-8000-000000000001') <> now() THEN
    RAISE EXCEPTION 'postmortems.updated_at not set by trigger';
  END IF;
  UPDATE action_items SET done = NOT done WHERE id = '00000000-0000-4000-8000-000000000203';
  IF (SELECT updated_at FROM action_items WHERE id = '00000000-0000-4000-8000-000000000203') <> now() THEN
    RAISE EXCEPTION 'action_items.updated_at not set by trigger';
  END IF;
END;
$$;

-- Deleting an incident removes its events, postmortem and action items.
DO $$
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM incident_events WHERE incident_id = '00000000-0000-4000-8000-000000000001')
          AND EXISTS (SELECT 1 FROM postmortems WHERE incident_id = '00000000-0000-4000-8000-000000000001')
          AND EXISTS (SELECT 1 FROM action_items WHERE incident_id = '00000000-0000-4000-8000-000000000001')) THEN
    RAISE EXCEPTION 'cascade test needs incident 1 with events, a postmortem and action items: load the seed';
  END IF;
END;
$$;
DELETE FROM incidents WHERE id = '00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM incident_events WHERE incident_id = '00000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM postmortems WHERE incident_id = '00000000-0000-4000-8000-000000000001')
     OR EXISTS (SELECT 1 FROM action_items WHERE incident_id = '00000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'delete did not cascade';
  END IF;
END;
$$;

\echo 'schema tests passed'
ROLLBACK;
