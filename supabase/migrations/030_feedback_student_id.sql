-- Add student_id column for per-student submission tracking
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES profiles(id);

-- Backfill existing rows from meta->>'submittedBy'
UPDATE feedback SET student_id = (meta->>'submittedBy')::uuid
WHERE student_id IS NULL AND meta ? 'submittedBy';

-- Remove duplicate rows keeping the earliest submission per student per session
DELETE FROM feedback
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY session_id, student_id
             ORDER BY created_at ASC
           ) AS rn
    FROM feedback
    WHERE student_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Prevent duplicate submissions: one feedback per student per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_student_session
ON feedback(session_id, student_id) WHERE student_id IS NOT NULL;

-- Index for student-based lookups (getStudentSubmissions)
CREATE INDEX IF NOT EXISTS idx_feedback_student_id ON feedback(student_id);
