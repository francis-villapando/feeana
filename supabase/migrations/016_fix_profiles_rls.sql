-- Fix profiles RLS - remove recursive policy
DROP POLICY IF EXISTS "Faculties can view all profiles" ON profiles;

-- RLS for profiles: users can read their own, no insert needed (managed by auth)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policy for faculty to view their students' profiles
-- Using auth.users directly to avoid recursion
CREATE POLICY "Faculty can view student profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes
      JOIN enrollments ON enrollments.class_id = classes.id
      WHERE classes.faculty_id = auth.uid()
      AND enrollments.student_id = profiles.id
    )
  );