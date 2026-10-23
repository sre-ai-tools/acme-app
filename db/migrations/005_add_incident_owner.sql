-- On-call owner of an incident (APP-7). Nullable: existing incidents have no owner.
--
-- Safe on a live table: adding a nullable column without a default only changes the catalog,
-- and the CHECK is added NOT VALID (no scan) and validated afterwards under a SHARE UPDATE
-- EXCLUSIVE lock, which doesn't block reads or writes. lock_timeout makes the brief ACCESS
-- EXCLUSIVE steps give up instead of queueing behind long transactions and blocking everyone.
SET lock_timeout = '5s';

BEGIN;
ALTER TABLE incidents ADD COLUMN owner text;
ALTER TABLE incidents
  ADD CONSTRAINT incidents_owner_length CHECK (char_length(owner) BETWEEN 1 AND 200) NOT VALID;
COMMIT;

ALTER TABLE incidents VALIDATE CONSTRAINT incidents_owner_length;

RESET lock_timeout;
