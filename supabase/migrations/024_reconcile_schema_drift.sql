-- ============================================================
-- Migration 024: Reconcile schema drift between migration chain
-- and production (hosted) schema.
--
-- The production database was modified manually (via Supabase
-- Dashboard / SQL Editor) after the initial migration chain.
-- This migration brings the local migration-based schema in
-- line with what production actually has — which is also what
-- the frontend code expects.
--
-- Changes:
--   1. ilos:    Drop unused `code` column (hosted never had it;
--               frontend ILO type doesn't reference it)
--   2. ilos:    Add `topic_id` FK to topics (hosted has it NOT
--               NULL; frontend passes topicId on createILO)
--   3. classes: Rename `join_code` → `enroll_code` (hosted uses
--               `enroll_code`; frontend maps Class.code from it)
--   4. classes: Rename unique index to match new column name
--   5. sessions: Change `ilo_ids` from jsonb → uuid[] (hosted
--                uses uuid[]; safer type, native UUID validation)
-- ============================================================

DO $$
BEGIN
  --------------------------------------------------------------------
  -- 1. Drop `code` column from ilos if it exists
  --------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ilos' AND column_name = 'code'
  ) THEN
    ALTER TABLE ilos DROP COLUMN code;
    RAISE NOTICE 'Dropped column ilos.code';
  END IF;

  --------------------------------------------------------------------
  -- 2. Add `topic_id` to ilos if missing
  --------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ilos' AND column_name = 'topic_id'
  ) THEN
    ALTER TABLE ilos ADD COLUMN topic_id uuid NOT NULL REFERENCES topics(id);
    RAISE NOTICE 'Added column ilos.topic_id';
  END IF;

  --------------------------------------------------------------------
  -- 3. Rename `join_code` → `enroll_code` on classes
  --------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'join_code'
  ) THEN
    ALTER TABLE classes RENAME COLUMN join_code TO enroll_code;
    RAISE NOTICE 'Renamed classes.join_code → enroll_code';
  END IF;

  --------------------------------------------------------------------
  -- 4. Rename unique index for classes.enroll_code
  --------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'classes' AND indexname = 'idx_classes_join_code'
  ) THEN
    ALTER INDEX idx_classes_join_code RENAME TO idx_classes_enroll_code;
    RAISE NOTICE 'Renamed index idx_classes_join_code → idx_classes_enroll_code';
  END IF;

  --------------------------------------------------------------------
  -- 5. Change ilo_ids from jsonb → uuid[] on sessions
  --------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'ilo_ids' AND data_type = 'jsonb'
  ) THEN
    -- Add a temporary uuid[] column
    ALTER TABLE sessions ADD COLUMN ilo_ids_new uuid[] DEFAULT '{}'::uuid[];

    -- Migrate existing jsonb data to uuid[]
    UPDATE sessions
    SET ilo_ids_new = ARRAY(
      SELECT value::uuid FROM jsonb_array_elements_text(ilo_ids)
    )
    WHERE ilo_ids IS NOT NULL AND ilo_ids::text != '[]';

    -- Swap columns
    ALTER TABLE sessions DROP COLUMN ilo_ids;
    ALTER TABLE sessions RENAME COLUMN ilo_ids_new TO ilo_ids;

    RAISE NOTICE 'Changed sessions.ilo_ids from jsonb → uuid[]';
  END IF;
END $$;
