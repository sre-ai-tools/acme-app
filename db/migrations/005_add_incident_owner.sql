-- On-call owner of an incident (APP-7). Nullable: existing incidents have no owner.
--
-- Safe on a live table: adding a nullable column without a default only changes the catalog,
-- and the CHECK is added NOT VALID (no scan) and validated afterwards under a SHARE UPDATE
-- EXCLUSIVE lock, which doesn't block reads or writes. lock_timeout makes the brief ACCESS
-- EXCLUSIVE steps give up instead of queueing behind long transactions and blocking everyone.
--
-- Run this file as written, not wrapped in one transaction by a migration runner: VALIDATE
-- must run after the COMMIT, or it scans the table while the ACCESS EXCLUSIVE lock is held.
-- It is safe to re-run after a lock_timeout failure.
SET lock_timeout = '5s';

BEGIN;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_owner_length;
-- Not blank, and at most 200 characters.
ALTER TABLE incidents
  ADD CONSTRAINT incidents_owner_length
  CHECK (btrim(owner) <> '' AND char_length(owner) <= 200) NOT VALID;
COMMIT;

ALTER TABLE incidents VALIDATE CONSTRAINT incidents_owner_length;

RESET lock_timeout;
