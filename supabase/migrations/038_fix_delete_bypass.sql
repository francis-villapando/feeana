-- Hardens the admin bypass inside prevent_delete() so that seed scripts,
-- CI teardowns, and supabase db reset can clear data without error.

CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
  is_admin boolean := false;
BEGIN
  -- 1. Direct superuser / admin-role check (covers apply-seed.ts, db reset)
  IF current_user IN ('postgres', 'service_role', 'supabase_admin', 'supabase_admin_local') THEN
    is_admin := true;
  END IF;

  -- 2. Session-level flag (covers any caller that sets app.allow_hard_delete)
  IF NOT is_admin THEN
    BEGIN
      IF current_setting('app.allow_hard_delete', true) = 'true' THEN
        is_admin := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- 3. JWT role extraction (covers service_role key via Supabase JS client)
  --    Dropped auth.role() fallback: it throws in non-Supabase Postgres,
  --    forcing exception-driven control flow on every DELETE.
  --    The two request.jwt settings cover all Supabase client paths.
  IF NOT is_admin THEN
    BEGIN
      jwt_role := coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        nullif(current_setting('role', true), '')
      );
    EXCEPTION WHEN OTHERS THEN
      jwt_role := null;
    END;

    IF jwt_role = 'service_role' THEN
      is_admin := true;
    END IF;
  END IF;

  -- Allow admin callers; block everyone else
  IF is_admin THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard-delete is not allowed. Use the archive workflow instead.';
END;
$$ LANGUAGE plpgsql;

-- Re-create triggers (idempotent via DROP IF EXISTS)
DROP TRIGGER IF EXISTS block_delete_classes ON classes;
CREATE TRIGGER block_delete_classes
  BEFORE DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

DROP TRIGGER IF EXISTS block_delete_sessions ON sessions;
CREATE TRIGGER block_delete_sessions
  BEFORE DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

DROP TRIGGER IF EXISTS block_delete_courses ON courses;
CREATE TRIGGER block_delete_courses
  BEFORE DELETE ON courses
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

DROP TRIGGER IF EXISTS block_delete_topics ON topics;
CREATE TRIGGER block_delete_topics
  BEFORE DELETE ON topics
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

DROP TRIGGER IF EXISTS block_delete_ilos ON ilos;
CREATE TRIGGER block_delete_ilos
  BEFORE DELETE ON ilos
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

DROP TRIGGER IF EXISTS block_delete_feedback ON feedback;
CREATE TRIGGER block_delete_feedback
  BEFORE DELETE ON feedback
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- 1.2: Add enrollments delete trigger gated behind the same bypass
DROP TRIGGER IF EXISTS block_delete_enrollments ON enrollments;
CREATE TRIGGER block_delete_enrollments
  BEFORE DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- 5.2: TRUNCATE ... CASCADE escape hatch for full environment reset
CREATE OR REPLACE FUNCTION admin_truncate_all()
RETURNS void AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'admin_truncate_all requires superuser';
  END IF;

  TRUNCATE feedback, sessions, classes, courses, topics, ilos,
           enrollments, analysis_results, feedback_diagnostics
           CASCADE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent non-admin roles from calling this function
REVOKE EXECUTE ON FUNCTION admin_truncate_all() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_truncate_all() TO postgres, supabase_admin;
