-- Add 59-second grace period to the feedback submission RLS policy.
-- A session ending at 5:00 PM should still accept submissions until 5:00:59.

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
      AND sessions.ends_at > now() - interval '59 seconds'
    )
  );
