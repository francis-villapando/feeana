-- Auto-close sessions once their end time passes.
-- pg_cron runs every minute; the active -> closed delay is <= 60 s.

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

SELECT cron.schedule(
  'close-expired-sessions',
  '* * * * *',
  $$UPDATE sessions SET status = 'closed' WHERE status = 'active' AND ends_at < now()$$
);
