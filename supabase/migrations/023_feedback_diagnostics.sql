CREATE TABLE IF NOT EXISTS feedback_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tti text NOT NULL,
  rbt integer NOT NULL,
  clt text NOT NULL,
  issue text NOT NULL,
  polarity text NOT NULL,
  is_gap boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_feedback ON feedback_diagnostics(feedback_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_session ON feedback_diagnostics(session_id);

ALTER TABLE feedback_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faculty can select diagnostics for own classes"
  ON feedback_diagnostics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      JOIN classes ON classes.id = sessions.class_id
      WHERE sessions.id = feedback_diagnostics.session_id
      AND classes.faculty_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can insert diagnostics for own classes"
  ON feedback_diagnostics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      JOIN classes ON classes.id = sessions.class_id
      WHERE sessions.id = feedback_diagnostics.session_id
      AND classes.faculty_id = auth.uid()
    )
  );

CREATE POLICY "Faculty can delete diagnostics for own classes"
  ON feedback_diagnostics FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      JOIN classes ON classes.id = sessions.class_id
      WHERE sessions.id = feedback_diagnostics.session_id
      AND classes.faculty_id = auth.uid()
    )
  );
