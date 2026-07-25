CREATE OR REPLACE FUNCTION public.check_if_faculty_of_class(_class_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = _class_id
      AND faculty_id = auth.uid()
  );
$$;