-- Migration 032: Allow students to re-enroll after soft-unenrolling

DROP POLICY IF EXISTS "Students can update their own enrollment" ON enrollments;

CREATE POLICY "Students can update their own enrollment"
  ON enrollments
  FOR UPDATE
  TO public
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
