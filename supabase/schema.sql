


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


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."assignment_role" AS ENUM (
    'Ton',
    'Licht',
    'Umbau',
    'Kleine'
);


ALTER TYPE "public"."assignment_role" OWNER TO "postgres";


CREATE TYPE "public"."availability_status" AS ENUM (
    'committed',
    'backup'
);


ALTER TYPE "public"."availability_status" OWNER TO "postgres";


CREATE TYPE "public"."knowledge_page_id" AS ENUM (
    'rules',
    'guides',
    'tech-bible',
    'ideas'
);


ALTER TYPE "public"."knowledge_page_id" OWNER TO "postgres";


CREATE TYPE "public"."request_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."request_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'technician'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "namespace" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "amount" integer DEFAULT 1 NOT NULL,
    "type" "text" DEFAULT ''::"text" NOT NULL,
    "state" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "comment" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."equipment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "column_id" "text" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" DEFAULT '#4a4a45'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "equipment_tags_column_id_check" CHECK (("column_id" = ANY (ARRAY['type'::"text", 'state'::"text"])))
);


ALTER TABLE "public"."equipment_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role" "public"."assignment_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role" "public"."assignment_role" NOT NULL,
    "attended" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "status" "public"."availability_status" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "location" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "tech_needs" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "presentation_files" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."event_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "location" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "status" "text" DEFAULT 'Nicht begonnen'::"text" NOT NULL,
    "contact_name" "text",
    "contact_email" "text",
    "microphone_count" integer,
    "tech_needs" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "request_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "presentation_files" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_pages" (
    "id" "public"."knowledge_page_id" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text"
);


ALTER TABLE "public"."knowledge_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "public"."knowledge_page_id" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landing_content" (
    "id" boolean DEFAULT true NOT NULL,
    "hero_title" "text" NOT NULL,
    "hero_text" "text" NOT NULL,
    "join_title" "text" NOT NULL,
    "join_text" "text" NOT NULL,
    "event_images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_image" "text" DEFAULT ''::"text" NOT NULL,
    "team_names" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "impressions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "content_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "landing_content_singleton" CHECK (("id" = true))
);


ALTER TABLE "public"."landing_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'technician'::"public"."user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "phone" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "motivation" "text" NOT NULL,
    "password" "text",
    "status" "public"."request_status" DEFAULT 'pending'::"public"."request_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."registration_requests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_options"
    ADD CONSTRAINT "app_options_namespace_label_key" UNIQUE ("namespace", "label");



ALTER TABLE ONLY "public"."app_options"
    ADD CONSTRAINT "app_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_items"
    ADD CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_tags"
    ADD CONSTRAINT "equipment_tags_column_id_label_key" UNIQUE ("column_id", "label");



ALTER TABLE ONLY "public"."equipment_tags"
    ADD CONSTRAINT "equipment_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_event_id_profile_id_role_key" UNIQUE ("event_id", "profile_id", "role");



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_event_id_profile_id_role_key" UNIQUE ("event_id", "profile_id", "role");



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_availability"
    ADD CONSTRAINT "event_availability_event_id_profile_id_key" UNIQUE ("event_id", "profile_id");



ALTER TABLE ONLY "public"."event_availability"
    ADD CONSTRAINT "event_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_requests"
    ADD CONSTRAINT "event_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_pages"
    ADD CONSTRAINT "knowledge_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_suggestions"
    ADD CONSTRAINT "knowledge_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landing_content"
    ADD CONSTRAINT "landing_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_requests"
    ADD CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_assignments"
    ADD CONSTRAINT "event_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attendance"
    ADD CONSTRAINT "event_attendance_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_availability"
    ADD CONSTRAINT "event_availability_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_availability"
    ADD CONSTRAINT "event_availability_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."event_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_suggestions"
    ADD CONSTRAINT "knowledge_suggestions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_suggestions"
    ADD CONSTRAINT "knowledge_suggestions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."knowledge_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "signed in users manage assignments" ON "public"."event_assignments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "signed in users manage attendance" ON "public"."event_attendance" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "admins manage event requests" ON "public"."event_requests" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "signed in users manage events" ON "public"."events" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "admins manage knowledge pages" ON "public"."knowledge_pages" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage knowledge suggestions" ON "public"."knowledge_suggestions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage landing content" ON "public"."landing_content" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage registration requests" ON "public"."registration_requests" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "app options visible to signed in users" ON "public"."app_options" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."app_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignments visible to signed in users" ON "public"."event_assignments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "attendance visible to signed in users" ON "public"."event_attendance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "availability visible to signed in users" ON "public"."event_availability" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "equipment tags visible to signed in users" ON "public"."equipment_tags" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "equipment visible to signed in users" ON "public"."equipment_items" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."equipment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events visible to signed in users" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "knowledge pages visible to signed in users" ON "public"."knowledge_pages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "knowledge suggestions visible to signed in users" ON "public"."knowledge_suggestions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."knowledge_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_suggestions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landing content visible to everyone" ON "public"."landing_content" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."landing_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles are visible to signed in users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "public can create event requests" ON "public"."event_requests" FOR INSERT TO "anon" WITH CHECK (("status" = 'pending'::"public"."request_status"));



CREATE POLICY "public can create registration requests" ON "public"."registration_requests" FOR INSERT TO "anon" WITH CHECK (("status" = 'pending'::"public"."request_status"));



ALTER TABLE "public"."registration_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "signed in users create knowledge suggestions" ON "public"."knowledge_suggestions" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "signed in users manage app options" ON "public"."app_options" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "signed in users manage equipment" ON "public"."equipment_items" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "signed in users manage equipment tags" ON "public"."equipment_tags" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "technicians manage own availability" ON "public"."event_availability" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "technicians update own availability" ON "public"."event_availability" FOR UPDATE TO "authenticated" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON TABLE "public"."app_options" TO "anon";
GRANT ALL ON TABLE "public"."app_options" TO "authenticated";
GRANT ALL ON TABLE "public"."app_options" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_items" TO "anon";
GRANT ALL ON TABLE "public"."equipment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_items" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_tags" TO "anon";
GRANT ALL ON TABLE "public"."equipment_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_tags" TO "service_role";



GRANT ALL ON TABLE "public"."event_assignments" TO "anon";
GRANT ALL ON TABLE "public"."event_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."event_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."event_attendance" TO "anon";
GRANT ALL ON TABLE "public"."event_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."event_availability" TO "anon";
GRANT ALL ON TABLE "public"."event_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."event_availability" TO "service_role";



GRANT ALL ON TABLE "public"."event_requests" TO "anon";
GRANT ALL ON TABLE "public"."event_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."event_requests" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_pages" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_pages" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."landing_content" TO "anon";
GRANT ALL ON TABLE "public"."landing_content" TO "authenticated";
GRANT ALL ON TABLE "public"."landing_content" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."registration_requests" TO "anon";
GRANT ALL ON TABLE "public"."registration_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_requests" TO "service_role";



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
