-- Marks rows that belong to the guided tour sandbox, so the app can keep them out
-- of real faculty lists and analytics aggregates.
--
-- courses is a single shared SAMPLE-COURSE row reused across replays; classes is
-- per-faculty, with a fresh class per replay and the previous one archived.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS is_tutorial boolean NOT NULL DEFAULT false;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS is_tutorial boolean NOT NULL DEFAULT false;

-- Visibility filters and rotation sweeps both scan by flag.
CREATE INDEX IF NOT EXISTS idx_courses_is_tutorial
  ON courses(is_tutorial) WHERE is_tutorial = true;

CREATE INDEX IF NOT EXISTS idx_classes_is_tutorial
  ON classes(faculty_id, is_tutorial) WHERE is_tutorial = true;
