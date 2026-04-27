CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id),
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp ON activity_log(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity, entity_id);