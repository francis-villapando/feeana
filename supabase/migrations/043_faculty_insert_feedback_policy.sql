-- Allow faculty to bulk-import feedback into sessions of
-- their own classes. Unlike the student policy, this is not gated
-- on session status so historical sessions can be populated too.
CREATE POLICY "Faculty can insert feedback for own sessions" ON public.feedback FOR
INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions
        JOIN public.classes ON public.classes.id = public.sessions.class_id
      WHERE public.sessions.id = feedback.session_id
        AND public.classes.faculty_id = auth.uid()
    )
  );