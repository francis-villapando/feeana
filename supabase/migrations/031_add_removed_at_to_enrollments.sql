ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS removed_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION update_class_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE classes SET student_count = GREATEST(0, student_count - 1) WHERE id = OLD.class_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.removed_at IS NOT NULL AND OLD.removed_at IS NULL THEN
      UPDATE classes SET student_count = GREATEST(0, student_count - 1) WHERE id = NEW.class_id;
    ELSIF NEW.removed_at IS NULL AND OLD.removed_at IS NOT NULL THEN
      UPDATE classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
    END IF;
    RETURN NEW;
 END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enrollment_student_count ON enrollments;
CREATE TRIGGER trg_enrollment_student_count
  AFTER INSERT OR DELETE OR UPDATE OF removed_at ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_class_student_count();

DROP POLICY IF EXISTS "Faculty can dismiss students from their own classes" ON enrollments;
DROP POLICY IF EXISTS "Students can delete own enrollments" ON enrollments;

CREATE POLICY "Faculty can dismiss students from their own classes"
  ON enrollments
  FOR UPDATE
  TO authenticated
  USING (check_if_faculty_of_class(class_id))
  WITH CHECK (check_if_faculty_of_class(class_id));

CREATE POLICY "Students can unenroll themselves"
  ON enrollments
  FOR UPDATE
  TO public
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id AND removed_at IS NOT NULL);
