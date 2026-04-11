CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "Market" (id, name, "createdAt")
VALUES
  (gen_random_uuid(), 'Nashville CBD', NOW()),
  (gen_random_uuid(), 'Dubai', NOW()),
  (gen_random_uuid(), 'Hamburg', NOW())
ON CONFLICT (name) DO NOTHING;
