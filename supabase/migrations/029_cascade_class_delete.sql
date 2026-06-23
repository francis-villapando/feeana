ALTER TABLE enrollments
  DROP CONSTRAINT enrollments_class_id_fkey,
  ADD CONSTRAINT enrollments_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE sessions
  DROP CONSTRAINT sessions_class_id_fkey,
  ADD CONSTRAINT sessions_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

ALTER TABLE feedback
  DROP CONSTRAINT feedback_session_id_fkey,
  ADD CONSTRAINT feedback_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE analysis_results
  DROP CONSTRAINT analysis_results_session_id_fkey,
  ADD CONSTRAINT analysis_results_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE submission_tokens
  DROP CONSTRAINT submission_tokens_session_id_fkey,
  ADD CONSTRAINT submission_tokens_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
