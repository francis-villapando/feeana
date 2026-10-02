-- First auto-start timestamp per user. Profiles RLS permits self update/insert.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tutorial_shown_at timestamptz;
COMMENT ON COLUMN profiles.tutorial_shown_at IS 'Timestamp of the first auto-started guided tour for this user; null means it has not auto-opened yet.';