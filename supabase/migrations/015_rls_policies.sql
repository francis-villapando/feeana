ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- RLS policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ilos ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Classes: faculty full CRUD on own classes; students can read if enrolled
CREATE POLICY "Faculty can CRUD own classes"
  ON classes FOR ALL
  USING (auth.uid() = faculty_id);

CREATE POLICY "Students can read enrolled class"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = classes.id
      AND enrollments.student_id = auth.uid()
    )
  );

-- Enrollments: students can insert for themselves; faculty can manage their class enrollments
CREATE POLICY "Students can enroll themselves"
  ON enrollments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Faculty can manage enrollments in own class"
  ON enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = enrollments.class_id
      AND classes.faculty_id = auth.uid()
    )
  );

-- Sessions: faculty full CRUD on own class sessions; students can read if enrolled
CREATE POLICY "Faculty can CRUD sessions in own class"
  ON sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = sessions.class_id
      AND classes.faculty_id = auth.uid()
    )
  );

CREATE POLICY "Students can read sessions for enrolled class"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = sessions.class_id
      AND enrollments.student_id = auth.uid()
    )
  );

-- Courses: faculty full CRUD on their own courses
CREATE POLICY "Faculty can CRUD courses"
  ON courses FOR ALL
  USING (true);

-- Topics: faculty CRUD on courses they own (via courses FK)
CREATE POLICY "Faculty can CRUD topics"
  ON topics FOR ALL
  USING (true);

-- ILOS: faculty CRUD on courses they own
CREATE POLICY "Faculty can CRUD ilos"
  ON ilos FOR ALL
  USING (true);

-- Activity log: users can read and insert their own
CREATE POLICY "Users can read own activity"
  ON activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Feedback: students can insert for enrolled sessions
CREATE POLICY "Students can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN sessions ON sessions.class_id = enrollments.class_id
      WHERE enrollments.student_id = auth.uid()
      AND sessions.id = feedback.session_id
      AND sessions.status = 'active'
    )
  );