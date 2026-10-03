-- Add optional new_label column to activity_log for entity renaming / update history
ALTER TABLE activity_log
ADD COLUMN IF NOT EXISTS new_label text;
