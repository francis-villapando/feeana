ALTER TABLE classes ADD COLUMN IF NOT EXISTS student_count int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION update_class_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE classes SET student_count = GREATEST(0, student_count - 1) WHERE id = OLD.class_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enrollment_student_count ON enrollments;
CREATE TRIGGER trg_enrollment_student_count
  AFTER INSERT OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_class_student_count();