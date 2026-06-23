ALTER TABLE ilos
  DROP CONSTRAINT ilos_topic_id_fkey,
  ADD CONSTRAINT ilos_topic_id_fkey
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
