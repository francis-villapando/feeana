ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ilo_ids jsonb DEFAULT '[]'::jsonb;