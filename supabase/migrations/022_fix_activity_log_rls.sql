-- Allow faculty to view all activity for the activity feed
DROP POLICY IF EXISTS "Users can read own activity" ON activity_log;

CREATE POLICY "Faculty can read all activity"
  ON activity_log FOR SELECT
  USING (true);