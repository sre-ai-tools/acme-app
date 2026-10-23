-- Development seed data for demos and screenshots. Never run against production.
-- Fixed ids make it safe to re-run: existing rows are left alone.
BEGIN;

INSERT INTO incidents (id, title, severity, status, started_at, resolved_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Checkout API returning 503s',            1, 'resolved',  '2026-10-01 14:02+00', '2026-10-01 15:10+00'),
  ('00000000-0000-4000-8000-000000000002', 'Elevated latency on search',             3, 'mitigated', '2026-10-12 09:30+00', NULL),
  ('00000000-0000-4000-8000-000000000003', 'Nightly export job failing',             4, 'open',      '2026-10-20 02:15+00', NULL),
  ('00000000-0000-4000-8000-000000000004', 'Login errors for SSO users in eu-west-1', 2, 'resolved', '2026-10-05 07:45+00', '2026-10-05 08:20+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO incident_events (id, incident_id, occurred_at, kind, body) VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', '2026-10-01 14:02+00', 'detection',     '5xx alarm fired on checkout-api.'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', '2026-10-01 14:09+00', 'communication', 'Status page updated: degraded checkout.'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', '2026-10-01 14:31+00', 'action',        'Rolled back deploy 2026.10.01-3.'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', '2026-10-01 15:10+00', 'note',          'Error rate back to baseline for 30 minutes.'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000002', '2026-10-12 09:30+00', 'detection',     'p99 latency SLO burn alert on search.'),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000002', '2026-10-12 10:05+00', 'action',        'Scaled search cluster from 6 to 9 nodes.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO postmortems (incident_id, summary, impact, root_cause) VALUES
  ('00000000-0000-4000-8000-000000000001',
   'A deploy exhausted the database connection pool and checkout failed for 68 minutes.',
   'About 4% of checkout attempts failed between 14:02 and 15:10 UTC.',
   'A new retry loop opened a connection per attempt and never released it on timeout.')
ON CONFLICT (incident_id) DO NOTHING;

INSERT INTO action_items (id, incident_id, description, owner, due_date, done) VALUES
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Add a connection pool saturation alarm.',     'payments-oncall', '2026-10-15', true),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Release connections in the retry path.',      'payments-team',   '2026-10-08', true),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'Load test checkout before each release.',     'payments-team',   '2026-11-01', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
