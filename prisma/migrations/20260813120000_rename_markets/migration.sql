-- Rename the two standard markets to their correct names.
-- Uses a guard so it is a no-op if a target name already exists (idempotent, avoids the
-- unique(name) collision).
UPDATE "Market"
SET name = 'BUR Dubai'
WHERE name = 'Dubai'
  AND NOT EXISTS (SELECT 1 FROM "Market" WHERE name = 'BUR Dubai');

UPDATE "Market"
SET name = 'Hamburg Center'
WHERE name = 'Hamburg'
  AND NOT EXISTS (SELECT 1 FROM "Market" WHERE name = 'Hamburg Center');
