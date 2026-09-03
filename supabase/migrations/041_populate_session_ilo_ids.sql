-- Backfill sessions.ilo_ids for any session created before the app started
-- deriving ILOs from the session's topic. A session's ILOs come from its topic
-- (course -> topics -> ILOs). Sessions without a topic_id or without topic ILOs
-- keep an empty array; the UI now shows nothing rather than all course ILOs.
UPDATE sessions s
SET ilo_ids = COALESCE(
  (SELECT array_agg(i.id) FROM ilos i WHERE i.topic_id = s.topic_id AND NOT i.archived),
  '{}'::uuid[]
)
WHERE s.topic_id IS NOT NULL
  AND (s.ilo_ids IS NULL OR cardinality(s.ilo_ids) = 0);
