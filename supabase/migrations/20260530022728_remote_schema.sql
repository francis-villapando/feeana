drop extension if exists "pg_net";

drop trigger if exists "trg_enrollment_student_count" on "public"."enrollments";

drop policy "Faculty can CRUD own classes" on "public"."classes";

drop policy "Students can read enrolled class" on "public"."classes";

drop policy "Faculty can manage enrollments in own class" on "public"."enrollments";

drop policy "Students can enroll themselves" on "public"."enrollments";

drop policy "Students can submit feedback" on "public"."feedback";

drop policy "Faculty can view student profiles" on "public"."profiles";

drop policy "Faculty can CRUD sessions in own class" on "public"."sessions";

drop policy "Students can read sessions for enrolled class" on "public"."sessions";

alter table "public"."activity_log" drop constraint "activity_log_user_id_fkey";

alter table "public"."ilos" drop constraint "ilos_topic_id_fkey";

alter table "public"."sessions" drop constraint "sessions_course_id_fkey";

alter table "public"."sessions" drop constraint "sessions_topic_id_fkey";

drop function if exists "public"."update_class_student_count"();

drop index if exists "public"."idx_activity_entity";

drop index if exists "public"."idx_activity_user_timestamp";

alter table "public"."activity_log" alter column "label" drop not null;

alter table "public"."activity_log" alter column "user_id" drop not null;

alter table "public"."analysis_results" enable row level security;

alter table "public"."classes" alter column "student_count" drop not null;

alter table "public"."profiles" alter column "full_name" set not null;

alter table "public"."submission_tokens" enable row level security;

CREATE UNIQUE INDEX courses_code_key ON public.courses USING btree (code);

CREATE INDEX idx_activity_log_timestamp ON public.activity_log USING btree ("timestamp" DESC);

CREATE INDEX idx_activity_log_user ON public.activity_log USING btree (user_id);

CREATE INDEX idx_ilos_topic ON public.ilos USING btree (topic_id);

alter table "public"."courses" add constraint "courses_code_key" UNIQUE using index "courses_code_key";

alter table "public"."activity_log" add constraint "activity_log_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."activity_log" validate constraint "activity_log_user_id_fkey";

alter table "public"."ilos" add constraint "ilos_topic_id_fkey" FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE RESTRICT not valid;

alter table "public"."ilos" validate constraint "ilos_topic_id_fkey";

alter table "public"."sessions" add constraint "sessions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL not valid;

alter table "public"."sessions" validate constraint "sessions_course_id_fkey";

alter table "public"."sessions" add constraint "sessions_topic_id_fkey" FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL not valid;

alter table "public"."sessions" validate constraint "sessions_topic_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_if_faculty_of_class(_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM classes
    WHERE id = _class_id
    AND faculty_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.consume_token_and_insert_feedback(p_session_id uuid, p_token_hash text, p_content text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH t AS (
    SELECT id FROM submission_tokens
    WHERE session_id = p_session_id AND token_hash = p_token_hash AND used = false
    FOR UPDATE
  ), u AS (
    UPDATE submission_tokens SET used = true, used_at = now() WHERE id IN (SELECT id FROM t) RETURNING id
  )
  INSERT INTO feedback (session_id, content, meta, created_at)
  SELECT p_session_id, p_content, COALESCE(p_meta, '{}'::jsonb), now() FROM u
  RETURNING feedback.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_used_token';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$function$
;


  create policy "Faculties can manage analysis results"
  on "public"."analysis_results"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM ((public.profiles p
     JOIN public.classes c ON ((c.faculty_id = p.id)))
     JOIN public.sessions s ON ((s.class_id = c.id)))
  WHERE ((p.id = auth.uid()) AND (p.role = 'faculty'::text) AND (s.id = analysis_results.session_id)))));



  create policy "Faculties can view all analysis results"
  on "public"."analysis_results"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Students can insert analysis results"
  on "public"."analysis_results"
  as permissive
  for insert
  to public
with check (true);



  create policy "Students can view analysis results"
  on "public"."analysis_results"
  as permissive
  for select
  to public
using (true);



  create policy "Faculties can CRUD own classes"
  on "public"."classes"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text) AND (profiles.id = classes.faculty_id)))));



  create policy "Faculties can view all classes"
  on "public"."classes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Students can find classes by join_code"
  on "public"."classes"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text)))));



  create policy "Students can view enrolled classes"
  on "public"."classes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.class_id = classes.id) AND (enrollments.student_id = auth.uid())))));



  create policy "Faculties can view all enrollments"
  on "public"."enrollments"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Faculty can dismiss students from their own classes"
  on "public"."enrollments"
  as permissive
  for delete
  to authenticated
using (public.check_if_faculty_of_class(class_id));



  create policy "Students can create enrollments"
  on "public"."enrollments"
  as permissive
  for insert
  to public
with check ((auth.uid() = student_id));



  create policy "Students can delete own enrollments"
  on "public"."enrollments"
  as permissive
  for delete
  to public
using ((auth.uid() = student_id));



  create policy "Students can view own enrollments"
  on "public"."enrollments"
  as permissive
  for select
  to public
using ((auth.uid() = student_id));



  create policy "Faculties can view all feedback"
  on "public"."feedback"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Faculties can view feedback for own classes"
  on "public"."feedback"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM ((public.profiles p
     JOIN public.classes c ON ((c.faculty_id = p.id)))
     JOIN public.sessions s ON ((s.class_id = c.id)))
  WHERE ((p.id = auth.uid()) AND (p.role = 'faculty'::text) AND (s.id = feedback.session_id)))));



  create policy "Students can insert feedback"
  on "public"."feedback"
  as permissive
  for insert
  to public
with check (true);



  create policy "Students can view own feedback"
  on "public"."feedback"
  as permissive
  for select
  to public
using (true);



  create policy "Enable insert for authenticated users"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can read all profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "Faculties can CRUD sessions for own classes"
  on "public"."sessions"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM (public.profiles p
     JOIN public.classes c ON ((c.faculty_id = p.id)))
  WHERE ((p.id = auth.uid()) AND (p.role = 'faculty'::text) AND (c.id = sessions.class_id)))));



  create policy "Faculties can view all sessions"
  on "public"."sessions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Participants can view sessions for enrolled classes"
  on "public"."sessions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.enrollments
  WHERE ((enrollments.class_id = sessions.class_id) AND (enrollments.student_id = auth.uid())))));



  create policy "Faculties can view all tokens"
  on "public"."submission_tokens"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'faculty'::text)))));



  create policy "Students can manage own tokens"
  on "public"."submission_tokens"
  as permissive
  for all
  to public
using ((auth.uid() = student_id));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


