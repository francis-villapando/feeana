-- Add created_by to courses so the app can dynamically isolate dev-seeded
-- curriculum from real faculty users.  NULL means legacy/shared (visible to all).

ALTER TABLE courses
  ADD COLUMN created_by uuid REFERENCES profiles(id);

-- Generic backfill: any course whose create action is recorded in activity_log
-- inherits its creator. Dev-seeded courses are handled here without
-- hardcoding course codes.
UPDATE courses c
SET created_by = al.user_id
FROM activity_log al
WHERE al.entity = 'course'
  AND al.entity_id = c.id
  AND al.action = 'created'
  AND c.created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);
