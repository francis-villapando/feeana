CREATE TABLE IF NOT EXISTS ilos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  code text NOT NULL,
  statement text NOT NULL,
  bloom_level text NOT NULL,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ilos_course ON ilos(course_id);
CREATE INDEX IF NOT EXISTS idx_ilos_archived ON ilos(archived);