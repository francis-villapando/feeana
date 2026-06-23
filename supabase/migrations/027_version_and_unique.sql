-- Add version columns for optimistic concurrency
ALTER TABLE courses ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE topics  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ilos    ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Clean up any existing duplicates before adding constraints
DELETE FROM topics a USING topics b
  WHERE a.id < b.id
    AND a.course_id = b.course_id
    AND a.title = b.title;

DELETE FROM ilos a USING ilos b
  WHERE a.id < b.id
    AND a.topic_id = b.topic_id
    AND a.statement = b.statement;

-- Add unique constraints (full — archived items also count)
ALTER TABLE topics ADD CONSTRAINT topics_course_id_title_key UNIQUE (course_id, title);
ALTER TABLE ilos   ADD CONSTRAINT ilos_topic_id_statement_key  UNIQUE (topic_id, statement);
