


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_if_faculty_of_class"("_class_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes
    WHERE id = _class_id
    AND faculty_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."check_if_faculty_of_class"("_class_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_token_and_insert_feedback"("p_session_id" "uuid", "p_token_hash" "text", "p_content" "text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."consume_token_and_insert_feedback"("p_session_id" "uuid", "p_token_hash" "text", "p_content" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "label" "text",
    "user_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analysis_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "result" "jsonb",
    "is_mock" boolean DEFAULT true,
    "model_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analysis_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faculty_id" "uuid" NOT NULL,
    "course" "text" NOT NULL,
    "section" "text" NOT NULL,
    "name" "text",
    "enroll_code" "text" NOT NULL,
    "topics" "jsonb" DEFAULT '[]'::"jsonb",
    "ilos" "jsonb" DEFAULT '[]'::"jsonb",
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "course_id" "uuid",
    "student_count" integer DEFAULT 0
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ilos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "statement" "text" NOT NULL,
    "bloom_level" "text" NOT NULL,
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "topic_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ilos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'student'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid" NOT NULL,
    "topic" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "course_id" "uuid",
    "topic_id" "uuid",
    "ilo_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submission_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."submission_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "archived" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analysis_results"
    ADD CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_class_id_student_id_key" UNIQUE ("class_id", "student_id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ilos"
    ADD CONSTRAINT "ilos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submission_tokens"
    ADD CONSTRAINT "submission_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_log_timestamp" ON "public"."activity_log" USING "btree" ("timestamp" DESC);



CREATE INDEX "idx_activity_log_user" ON "public"."activity_log" USING "btree" ("user_id");



CREATE INDEX "idx_analysis_session" ON "public"."analysis_results" USING "btree" ("session_id");



CREATE INDEX "idx_classes_course_id" ON "public"."classes" USING "btree" ("course_id");



CREATE UNIQUE INDEX "idx_classes_join_code" ON "public"."classes" USING "btree" ("enroll_code");



CREATE INDEX "idx_courses_archived" ON "public"."courses" USING "btree" ("archived");



CREATE INDEX "idx_courses_code" ON "public"."courses" USING "btree" ("code");



CREATE INDEX "idx_feedback_session" ON "public"."feedback" USING "btree" ("session_id");



CREATE INDEX "idx_ilos_archived" ON "public"."ilos" USING "btree" ("archived");



CREATE INDEX "idx_ilos_course" ON "public"."ilos" USING "btree" ("course_id");



CREATE INDEX "idx_ilos_topic" ON "public"."ilos" USING "btree" ("topic_id");



CREATE INDEX "idx_submission_tokens_sid_hash" ON "public"."submission_tokens" USING "btree" ("session_id", "token_hash");



CREATE INDEX "idx_topics_archived" ON "public"."topics" USING "btree" ("archived");



CREATE INDEX "idx_topics_course" ON "public"."topics" USING "btree" ("course_id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analysis_results"
    ADD CONSTRAINT "analysis_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_instructor_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."enrollments"
    ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."ilos"
    ADD CONSTRAINT "ilos_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ilos"
    ADD CONSTRAINT "ilos_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submission_tokens"
    ADD CONSTRAINT "submission_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."submission_tokens"
    ADD CONSTRAINT "submission_tokens_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



CREATE POLICY "Enable insert for authenticated users" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Faculties can CRUD own classes" ON "public"."classes" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text") AND ("profiles"."id" = "classes"."faculty_id")))));



CREATE POLICY "Faculties can CRUD sessions for own classes" ON "public"."sessions" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."classes" "c" ON (("c"."faculty_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'faculty'::"text") AND ("c"."id" = "sessions"."class_id")))));



CREATE POLICY "Faculties can manage analysis results" ON "public"."analysis_results" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "p"
     JOIN "public"."classes" "c" ON (("c"."faculty_id" = "p"."id")))
     JOIN "public"."sessions" "s" ON (("s"."class_id" = "c"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'faculty'::"text") AND ("s"."id" = "analysis_results"."session_id")))));



CREATE POLICY "Faculties can view all analysis results" ON "public"."analysis_results" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view all classes" ON "public"."classes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view all enrollments" ON "public"."enrollments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view all feedback" ON "public"."feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view all sessions" ON "public"."sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view all tokens" ON "public"."submission_tokens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'faculty'::"text")))));



CREATE POLICY "Faculties can view feedback for own classes" ON "public"."feedback" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "p"
     JOIN "public"."classes" "c" ON (("c"."faculty_id" = "p"."id")))
     JOIN "public"."sessions" "s" ON (("s"."class_id" = "c"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'faculty'::"text") AND ("s"."id" = "feedback"."session_id")))));



CREATE POLICY "Faculty can CRUD courses" ON "public"."courses" USING (true);



CREATE POLICY "Faculty can CRUD ilos" ON "public"."ilos" USING (true);



CREATE POLICY "Faculty can CRUD topics" ON "public"."topics" USING (true);



CREATE POLICY "Faculty can dismiss students from their own classes" ON "public"."enrollments" FOR DELETE TO "authenticated" USING ("public"."check_if_faculty_of_class"("class_id"));



CREATE POLICY "Faculty can read all activity" ON "public"."activity_log" FOR SELECT USING (true);



CREATE POLICY "Participants can view sessions for enrolled classes" ON "public"."sessions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."class_id" = "sessions"."class_id") AND ("enrollments"."student_id" = "auth"."uid"())))));



CREATE POLICY "Students can create enrollments" ON "public"."enrollments" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can delete own enrollments" ON "public"."enrollments" FOR DELETE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can find classes by join_code" ON "public"."classes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'student'::"text")))));



CREATE POLICY "Students can insert analysis results" ON "public"."analysis_results" FOR INSERT WITH CHECK (true);



CREATE POLICY "Students can insert feedback" ON "public"."feedback" FOR INSERT WITH CHECK (true);



CREATE POLICY "Students can manage own tokens" ON "public"."submission_tokens" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view analysis results" ON "public"."analysis_results" FOR SELECT USING (true);



CREATE POLICY "Students can view enrolled classes" ON "public"."classes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enrollments"
  WHERE (("enrollments"."class_id" = "classes"."id") AND ("enrollments"."student_id" = "auth"."uid"())))));



CREATE POLICY "Students can view own enrollments" ON "public"."enrollments" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view own feedback" ON "public"."feedback" FOR SELECT USING (true);



CREATE POLICY "Users can insert own activity" ON "public"."activity_log" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analysis_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ilos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submission_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."check_if_faculty_of_class"("_class_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_if_faculty_of_class"("_class_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_if_faculty_of_class"("_class_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_token_and_insert_feedback"("p_session_id" "uuid", "p_token_hash" "text", "p_content" "text", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_token_and_insert_feedback"("p_session_id" "uuid", "p_token_hash" "text", "p_content" "text", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_token_and_insert_feedback"("p_session_id" "uuid", "p_token_hash" "text", "p_content" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."analysis_results" TO "anon";
GRANT ALL ON TABLE "public"."analysis_results" TO "authenticated";
GRANT ALL ON TABLE "public"."analysis_results" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."enrollments" TO "anon";
GRANT ALL ON TABLE "public"."enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."ilos" TO "anon";
GRANT ALL ON TABLE "public"."ilos" TO "authenticated";
GRANT ALL ON TABLE "public"."ilos" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."submission_tokens" TO "anon";
GRANT ALL ON TABLE "public"."submission_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































