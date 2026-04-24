CREATE TABLE IF NOT EXISTS analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id),
  result jsonb,
  is_mock boolean DEFAULT true,
  model_version text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analysis_session ON analysis_results(session_id);
