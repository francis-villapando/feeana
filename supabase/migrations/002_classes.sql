CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid NOT NULL REFERENCES profiles(id),
  course text NOT NULL,
  section text NOT NULL,
  name text,
  join_code text NOT NULL,
  topics jsonb DEFAULT '[]'::jsonb,
  ilos jsonb DEFAULT '[]'::jsonb,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);
