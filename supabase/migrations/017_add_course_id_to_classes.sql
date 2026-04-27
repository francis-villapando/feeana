-- Add course_id foreign key to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_classes_course_id ON classes(course_id);