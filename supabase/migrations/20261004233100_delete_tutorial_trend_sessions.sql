CREATE OR REPLACE FUNCTION public.delete_tutorial_trend_sessions(
  p_class_id uuid,
  p_base_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base_topic text;
  v_base_ends_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT s.topic, s.ends_at
  INTO v_base_topic, v_base_ends_at
  FROM public.sessions s
  JOIN public.classes c ON c.id = s.class_id
  WHERE s.id = p_base_session_id
    AND s.class_id = p_class_id
    AND c.faculty_id = auth.uid()
    AND c.is_tutorial = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tutorial session not found or access denied.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.sessions s
  WHERE s.class_id = p_class_id
    AND s.created_by = auth.uid()
    AND (
      (
        s.topic = v_base_topic || ' (Session 2)'
        AND s.starts_at = v_base_ends_at + interval '24 hours'
        AND s.ends_at = v_base_ends_at + interval '48 hours'
      )
      OR (
        s.topic = v_base_topic || ' (Session 3)'
        AND s.starts_at = v_base_ends_at + interval '72 hours'
        AND s.ends_at = v_base_ends_at + interval '96 hours'
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tutorial_trend_sessions(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tutorial_trend_sessions(uuid, uuid) TO authenticated;
