-- 045_allow_delete_tutorial_data.sql
-- Allows hard DELETE exclusively on tutorial-tagged rows across protected tables
-- and creates an atomic RPC delete_tutorial_sandbox() function.

CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role text;
  is_admin boolean := false;
  is_tut boolean := false;
BEGIN
  -- 1. Admin bypass (service_role, postgres, supabase_admin, session setting)
  IF current_user IN ('postgres', 'service_role', 'supabase_admin', 'supabase_admin_local') THEN
    is_admin := true;
  END IF;

  IF NOT is_admin THEN
    BEGIN
      IF current_setting('app.allow_hard_delete', true) = 'true' THEN
        is_admin := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF NOT is_admin THEN
    BEGIN
      jwt_role := coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        nullif(current_setting('role', true), '')
      );
    EXCEPTION WHEN OTHERS THEN jwt_role := null;
    END;
    IF jwt_role = 'service_role' THEN is_admin := true; END IF;
  END IF;

  IF is_admin THEN RETURN OLD; END IF;

  -- 2. Scoped Tutorial Data Bypass
  IF TG_TABLE_NAME = 'courses' THEN
    is_tut := (OLD.is_tutorial = true);
  ELSIF TG_TABLE_NAME = 'classes' THEN
    is_tut := (OLD.is_tutorial = true);
  ELSIF TG_TABLE_NAME = 'topics' THEN
    SELECT is_tutorial INTO is_tut FROM courses WHERE id = OLD.course_id;
  ELSIF TG_TABLE_NAME = 'ilos' THEN
    SELECT is_tutorial INTO is_tut FROM courses WHERE id = OLD.course_id;
  ELSIF TG_TABLE_NAME = 'sessions' THEN
    SELECT is_tutorial INTO is_tut FROM classes WHERE id = OLD.class_id;
  ELSIF TG_TABLE_NAME = 'feedback' THEN
    SELECT c.is_tutorial INTO is_tut
    FROM sessions s JOIN classes c ON s.class_id = c.id
    WHERE s.id = OLD.session_id;
  ELSIF TG_TABLE_NAME = 'enrollments' THEN
    SELECT is_tutorial INTO is_tut FROM classes WHERE id = OLD.class_id;
  END IF;

  IF coalesce(is_tut, false) = true THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard-delete is not allowed for non-tutorial data. Use the archive workflow instead.';
END;
$$ LANGUAGE plpgsql;

-- 3. Server-side atomic deletion function
CREATE OR REPLACE FUNCTION public.delete_tutorial_sandbox()
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Delete tutorial classes owned by this faculty member (cascades to sessions, feedback, diagnostics, enrollments)
  DELETE FROM classes
  WHERE faculty_id = v_uid AND is_tutorial = true;

  -- Delete tutorial courses created by this faculty member (cascades to topics, ilos)
  DELETE FROM courses
  WHERE created_by = v_uid AND is_tutorial = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
