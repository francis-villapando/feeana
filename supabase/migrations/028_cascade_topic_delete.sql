-- Change topic_id FK on ilos to CASCADE so deleting a topic removes its ILOs
ALTER TABLE ilos
  DROP CONSTRAINT ilos_topic_id_fkey,
  ADD CONSTRAINT ilos_topic_id_fkey
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;
