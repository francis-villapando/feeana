-- RLS defense-in-depth: restrict student feedback submissions to active sessions.
-- Also drop pg_cron (replaced by lazy-write in the application layer).

-- 1. Remove the cron job that auto-closed sessions
SELECT cron.unschedule('close-expired-sessions');

-- 2. Students can only submit feedback when the session is active AND its end time hasn't passed
DROP POLICY IF EXISTS "Students can submit feedback" ON feedback;
CREATE POLICY "Students can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN sessions ON sessions.class_id = enrollments.class_id
      WHERE enrollments.student_id = auth.uid()
      AND sessions.id = feedback.session_id
      AND sessions.status = 'active'
      AND sessions.ends_at > now()
    )
  );
