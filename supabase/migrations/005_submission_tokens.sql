CREATE TABLE IF NOT EXISTS submission_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id),
  token_hash text NOT NULL,
  student_id uuid NOT NULL REFERENCES profiles(id),
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_submission_tokens_sid_hash ON submission_tokens(session_id, token_hash);
