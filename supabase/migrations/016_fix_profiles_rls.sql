-- Fix profiles RLS - remove recursive policy
DROP POLICY IF EXISTS "Faculties can view all profiles" ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Faculty can view student profiles" ON profiles;
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
