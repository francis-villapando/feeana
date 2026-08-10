-- Safety net: prevent hard-deletes on all core tables.
-- All data removal must go through the archive workflow instead.

CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
BEGIN
  -- Safe extraction of JWT role without jsonb casting errors
  BEGIN
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
      auth.role()
    );
  EXCEPTION WHEN OTHERS THEN
    jwt_role := null;
  END;

  -- Allow service_role key, postgres superuser, or explicit admin session flag to perform hard deletes for seeds/test resets
  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'service_role', 'supabase_admin')
     OR current_setting('app.allow_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  
  RAISE EXCEPTION 'Hard-delete is not allowed. Use the archive workflow instead.';
END;
$$ LANGUAGE plpgsql;

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
