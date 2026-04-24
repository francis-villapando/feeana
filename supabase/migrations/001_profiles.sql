CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  full_name text,
  role text DEFAULT 'student',
  created_at timestamptz DEFAULT now()
);
