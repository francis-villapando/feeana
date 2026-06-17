-- Refactor analysis_results and feedback_diagnostics for the decoupled pipeline.
--
-- New responsibilities:
--   analysis_results     → per-feedback raw ML output { issue, polarity } (Module 3)
--   feedback_diagnostics → per-session cached computed result (JSONB + rules_version)

-- 1. Rebuild analysis_results
DROP INDEX IF EXISTS idx_analysis_session;
ALTER TABLE analysis_results DROP COLUMN IF EXISTS result;
ALTER TABLE analysis_results DROP COLUMN IF EXISTS is_mock;
ALTER TABLE analysis_results DROP COLUMN IF EXISTS model_version;

ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS feedback_id uuid REFERENCES feedback(id) ON DELETE CASCADE;
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS issue text NOT NULL DEFAULT '';
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS polarity text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analysis_session ON analysis_results(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_feedback ON analysis_results(feedback_id);

-- 2. Rebuild feedback_diagnostics
DROP INDEX IF EXISTS idx_diagnostics_feedback;
DROP INDEX IF EXISTS idx_diagnostics_session;

ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS feedback_id;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS tti;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS rbt;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS clt;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS issue;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS polarity;
ALTER TABLE feedback_diagnostics DROP COLUMN IF EXISTS is_gap;

ALTER TABLE feedback_diagnostics ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE feedback_diagnostics ADD COLUMN IF NOT EXISTS rules_version text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_diagnostics_session ON feedback_diagnostics(session_id);

DELETE FROM feedback_diagnostics
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY session_id ORDER BY created_at DESC
    ) AS rn
    FROM feedback_diagnostics
  ) sub
  WHERE sub.rn > 1
);

-- Restrict to one cache row per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnostics_unique_session ON feedback_diagnostics(session_id);

-- Drop old RLS policies (they referenced columns that no longer exist)
DROP POLICY IF EXISTS "Faculty can select diagnostics for own classes" ON feedback_diagnostics;
DROP POLICY IF EXISTS "Faculty can insert diagnostics for own classes" ON feedback_diagnostics;
DROP POLICY IF EXISTS "Faculty can delete diagnostics for own classes" ON feedback_diagnostics;

-- Recreate RLS for the new feedback_diagnostics shape
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
