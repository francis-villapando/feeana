-- Decoupled Identity & Anonymous Payload Architecture (Receipt Pattern).
--
-- Separates "who participated" (session_participations) from "what was
-- submitted" (feedback). After this migration, no column, metadata field, or
-- trigger on `feedback` links a submission to a student identity.

-- 1. Participation table: the only place a student identity is recorded.
CREATE TABLE IF NOT EXISTS session_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_session_participations_session
  ON session_participations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participations_student
  ON session_participations(student_id);

-- 2. RLS: students see only their own participation; faculties see
-- participation for sessions in their own classes.
ALTER TABLE session_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own participation" ON session_participations;
CREATE POLICY "Students can view own participation"
  ON session_participations FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Faculties can view participation for own classes" ON session_participations;
CREATE POLICY "Faculties can view participation for own classes"
  ON session_participations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM sessions
      JOIN classes ON classes.id = sessions.class_id
      WHERE sessions.id = session_participations.session_id
        AND classes.faculty_id = auth.uid()
    )
  );

-- 3. Backfill participation history from existing feedback rows before the
-- identity fields are destroyed. Prefer the explicit student_id column, and
-- fall back to meta->>'submittedBy' for rows that predate migration 030.
INSERT INTO session_participations (session_id, student_id, created_at)
SELECT DISTINCT ON (session_id, student_id)
  session_id,
  COALESCE(student_id, (meta->>'submittedBy')::uuid) AS student_id,
  created_at
FROM feedback
WHERE student_id IS NOT NULL OR meta ? 'submittedBy'
ON CONFLICT (session_id, student_id) DO NOTHING;

-- 4. Permanently scrub identity from feedback.
ALTER TABLE feedback DROP COLUMN IF EXISTS student_id;
UPDATE feedback SET meta = meta - 'submittedBy' WHERE meta ? 'submittedBy';

-- Drop indexes that only existed to support the removed student_id column.
DROP INDEX IF EXISTS idx_feedback_student_session;
DROP INDEX IF EXISTS idx_feedback_student_id;

-- 5. Atomic submission RPC. SECURITY DEFINER so it can write both tables while
-- bypassing RLS; the participation UNIQUE constraint enforces one submission
-- per student per session atomically.
CREATE OR REPLACE FUNCTION public.submit_anonymous_feedback(
  p_session_id uuid,
  p_content text,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_feedback_id uuid;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Session must exist, be active, and still be within its window (with the
  -- same 59-second grace period used by the feedback RLS policy).
  IF NOT EXISTS (
    SELECT 1 FROM sessions
    WHERE id = p_session_id
      AND status = 'active'
      AND ends_at > now() - interval '59 seconds'
  ) THEN
    RAISE EXCEPTION 'session_not_open';
  END IF;

  -- Caller must be actively enrolled in the session's class.
  IF NOT EXISTS (
    SELECT 1 FROM enrollments
    JOIN sessions ON sessions.class_id = enrollments.class_id
    WHERE enrollments.student_id = v_student_id
      AND enrollments.removed_at IS NULL
      AND sessions.id = p_session_id
  ) THEN
    RAISE EXCEPTION 'not_enrolled';
  END IF;

  -- Record participation. The UNIQUE(session_id, student_id) constraint makes
  -- this the single point of duplicate-submission prevention.
  BEGIN
    INSERT INTO session_participations (session_id, student_id)
    VALUES (p_session_id, v_student_id);
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'already_submitted';
  END;

  -- Insert the anonymous payload with a coarsened timestamp so exact
  -- submission times cannot be correlated back to a student.
  INSERT INTO feedback (session_id, content, meta, created_at)
  VALUES (
    p_session_id,
    p_content,
    p_meta,
    date_trunc('minute', now())
  )
  RETURNING id INTO v_feedback_id;

  RETURN v_feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_anonymous_feedback(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_anonymous_feedback(uuid, text, jsonb) TO authenticated;
