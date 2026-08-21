


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






CREATE TYPE "public"."doc_priority" AS ENUM (
    'routine',
    'urgent'
);


ALTER TYPE "public"."doc_priority" OWNER TO "postgres";


CREATE TYPE "public"."doc_status" AS ENUM (
    'pending',
    'routing',
    'sealed',
    'cancelled'
);


ALTER TYPE "public"."doc_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'pho_staff'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_routed_doc"("doc_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM document_logs 
    WHERE document_id = doc_id 
    AND created_by = auth.uid()
  );
$$;


ALTER FUNCTION "public"."check_user_routed_doc"("doc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_server_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Explicitly strip any client-provided timestamp
    NEW.handed_over_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."force_server_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    new.id, 
    'New Employee', -- We can update this later via the UI
    'pho_staff',    -- Default role for all new accounts
    true
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_document_access"("doc_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    -- 1. Are they the creator?
    EXISTS (SELECT 1 FROM documents WHERE id = doc_id AND created_by = (SELECT auth.uid()))
    OR
    -- 2. Are they the physical custodian?
    EXISTS (SELECT 1 FROM documents WHERE id = doc_id AND custodian_id = (SELECT auth.uid()))
    OR
    -- 3. THE FIX: Are they the assigned clerk? (Matches the profile's full_name)
    EXISTS (
        SELECT 1 FROM documents 
        WHERE id = doc_id AND assigned_clerk = (SELECT full_name FROM profiles WHERE id = (SELECT auth.uid()))
    )
    OR
    -- 4. Have they EVER handled/routed this document in the past?
    EXISTS (SELECT 1 FROM routing_logs WHERE document_id = doc_id AND handled_by = (SELECT auth.uid()))
    OR
    -- 5. Are they a system admin?
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin');
$$;


ALTER FUNCTION "public"."has_document_access"("doc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_log_tampering"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RAISE EXCEPTION 'Routing logs are immutable and cannot be updated or deleted.';
END;
$$;


ALTER FUNCTION "public"."prevent_log_tampering"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_document_action"("p_doc_id" "uuid", "p_log_action" "text", "p_log_location" "text" DEFAULT 'Processing'::"text", "p_log_created_by" "uuid" DEFAULT NULL::"uuid", "p_log_assigned_to" "text" DEFAULT NULL::"text", "p_log_remarks" "text" DEFAULT NULL::"text", "p_log_signature_url" "text" DEFAULT NULL::"text", "p_log_attachment_url" "text" DEFAULT NULL::"text", "p_new_status" "text" DEFAULT NULL::"text", "p_new_location" "text" DEFAULT NULL::"text", "p_new_clerk" "text" DEFAULT NULL::"text", "p_new_remarks" "text" DEFAULT NULL::"text", "p_clear_remarks" boolean DEFAULT false, "p_completed_attachment_url" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.documents
    SET 
        -- THE FIX: Safely casting between TEXT and your custom doc_status ENUM
        status = COALESCE(p_new_status, status::TEXT)::doc_status,
        current_location = COALESCE(p_new_location, current_location),
        assigned_clerk = COALESCE(p_new_clerk, assigned_clerk),
        remarks = CASE WHEN p_clear_remarks THEN NULL ELSE COALESCE(p_new_remarks, remarks) END,
        completed_attachment_url = COALESCE(p_completed_attachment_url, completed_attachment_url),
        updated_at = NOW()
    WHERE id = p_doc_id;

    INSERT INTO public.document_logs (
        document_id, action, location, assigned_to, remarks, created_by, signature_url, attachment_url
    ) VALUES (
        p_doc_id, p_log_action, COALESCE(p_log_location, 'Processing'), p_log_assigned_to, p_log_remarks, p_log_created_by, p_log_signature_url, p_log_attachment_url
    );
END;
$$;


ALTER FUNCTION "public"."process_document_action"("p_doc_id" "uuid", "p_log_action" "text", "p_log_location" "text", "p_log_created_by" "uuid", "p_log_assigned_to" "text", "p_log_remarks" "text", "p_log_signature_url" "text", "p_log_attachment_url" "text", "p_new_status" "text", "p_new_location" "text", "p_new_clerk" "text", "p_new_remarks" "text", "p_clear_remarks" boolean, "p_completed_attachment_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."route_document"("p_document_id" "uuid", "p_office_id" "uuid", "p_clerk_name" "text", "p_signature_path" "text") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_custodian_id UUID;
    v_doc_status doc_status;
    v_log_id UUID;
BEGIN
    -- 1. Validate Custody and Status
    SELECT custodian_id, status INTO v_custodian_id, v_doc_status 
    FROM documents 
    WHERE id = p_document_id 
    FOR UPDATE; -- Lock the row to prevent race conditions

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found.';
    END IF;

    IF v_doc_status = 'sealed' THEN
        RAISE EXCEPTION 'Cannot route a sealed document.';
    END IF;

    IF v_custodian_id != auth.uid() THEN
        RAISE EXCEPTION 'Zero Trust Violation: You do not have custody of this document.';
    END IF;

    -- 2. Insert the Immutable Log
    INSERT INTO routing_logs (
        document_id, office_id, handled_by, clerk_name, signature_path
    ) VALUES (
        p_document_id, p_office_id, auth.uid(), p_clerk_name, p_signature_path
    ) RETURNING id INTO v_log_id;

    -- 3. Update Document State (Transition to routing if pending)
    UPDATE documents 
    SET status = 'routing' 
    WHERE id = p_document_id AND status = 'pending';

    -- 4. Return Success Payload to Frontend
    RETURN json_build_object(
        'success', true,
        'log_id', v_log_id,
        'message', 'Custody handover locked successfully.'
    );
END;
$$;


ALTER FUNCTION "public"."route_document"("p_document_id" "uuid", "p_office_id" "uuid", "p_clerk_name" "text", "p_signature_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" integer NOT NULL,
    "user_name" "text" NOT NULL,
    "action" "text" NOT NULL,
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."audit_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."audit_logs_id_seq" OWNED BY "public"."audit_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "category_id" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "office_id" "text",
    "office_address" "text"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."destination_offices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "office_name" "text" NOT NULL,
    "department" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."destination_offices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid",
    "action" "text" NOT NULL,
    "location" "text",
    "assigned_to" "text",
    "remarks" "text",
    "attachment_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid",
    "signature_url" "text"
);


ALTER TABLE "public"."document_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_no" "text" NOT NULL,
    "title" "text" NOT NULL,
    "priority" "public"."doc_priority" DEFAULT 'routine'::"public"."doc_priority",
    "status" "public"."doc_status" DEFAULT 'pending'::"public"."doc_status",
    "custodian_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "final_destination" "text",
    "is_urgent" boolean DEFAULT false,
    "remarks" "text",
    "current_location" "text" DEFAULT 'Originating Office'::"text",
    "attachment_url" "text",
    "assigned_clerk" "text",
    "completed_attachment_url" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."documents"."attachment_url" IS 'attachments for the documents';



COMMENT ON COLUMN "public"."documents"."assigned_clerk" IS 'for assigned clerh';



CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "emp_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "designation" "text" NOT NULL,
    "department" "text" NOT NULL,
    "contact_number" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "maintenance_mode" boolean DEFAULT false,
    "session_timeout" "text" DEFAULT '30'::"text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'pho_staff'::"public"."user_role",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "emp_id" "text",
    "designation" "text",
    "department" "text",
    "contact_number" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routing_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid",
    "office_id" "uuid",
    "handled_by" "uuid",
    "clerk_name" "text" NOT NULL,
    "signature_path" "text" NOT NULL,
    "handed_over_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."routing_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."audit_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."destination_offices"
    ADD CONSTRAINT "destination_offices_office_name_key" UNIQUE ("office_name");



ALTER TABLE ONLY "public"."destination_offices"
    ADD CONSTRAINT "destination_offices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_logs"
    ADD CONSTRAINT "document_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_reference_no_key" UNIQUE ("reference_no");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_emp_id_key" UNIQUE ("emp_id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routing_logs"
    ADD CONSTRAINT "routing_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_docs_status_clerk" ON "public"."documents" USING "btree" ("status", "assigned_clerk");



CREATE INDEX "idx_docs_status_creator" ON "public"."documents" USING "btree" ("status", "created_by");



CREATE OR REPLACE TRIGGER "enforce_append_only" BEFORE DELETE OR UPDATE ON "public"."routing_logs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_log_tampering"();



CREATE OR REPLACE TRIGGER "set_secure_timestamp" BEFORE INSERT ON "public"."routing_logs" FOR EACH ROW EXECUTE FUNCTION "public"."force_server_timestamp"();



CREATE OR REPLACE TRIGGER "update_documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."document_logs"
    ADD CONSTRAINT "document_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."document_logs"
    ADD CONSTRAINT "document_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_custodian_id_fkey" FOREIGN KEY ("custodian_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routing_logs"
    ADD CONSTRAINT "routing_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routing_logs"
    ADD CONSTRAINT "routing_logs_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."routing_logs"
    ADD CONSTRAINT "routing_logs_office_id_fkey" FOREIGN KEY ("office_id") REFERENCES "public"."destination_offices"("id");



CREATE POLICY "Allow clerks to route and update documents" ON "public"."documents" FOR UPDATE USING ((("auth"."uid"() = "created_by") OR ("assigned_clerk" = ( SELECT "profiles"."full_name"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (true);



CREATE POLICY "Allow clerks to update and handoff documents" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "created_by") OR ("assigned_clerk" = ( SELECT "profiles"."full_name"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role")));



CREATE POLICY "Audit_Insert" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Audit_Select" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Cat_Delete" ON "public"."categories" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Cat_Insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Cat_Select" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Cat_Update" ON "public"."categories" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Dept_Delete" ON "public"."departments" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Dept_Insert" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Dept_Select" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Dept_Update" ON "public"."departments" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Doc_Insert" ON "public"."documents" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Doc_Select" ON "public"."documents" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("custodian_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("assigned_clerk" = ( SELECT "profiles"."full_name"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) OR "public"."check_user_routed_doc"("id") OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role")));



CREATE POLICY "Doc_Update" ON "public"."documents" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("custodian_id" = "auth"."uid"()) OR ("assigned_clerk" = ( SELECT "profiles"."full_name"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'admin'::"public"."user_role")));



CREATE POLICY "Emp_Delete" ON "public"."employees" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Emp_Insert" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Emp_Select" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Emp_Update" ON "public"."employees" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "GS_Select" ON "public"."global_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "GS_Update" ON "public"."global_settings" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Log_Insert" ON "public"."document_logs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "document_logs"."document_id") AND (("documents"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("documents"."custodian_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("documents"."assigned_clerk" = ( SELECT "profiles"."full_name"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) OR (( SELECT "profiles"."role"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"))))));



CREATE POLICY "Office_Delete" ON "public"."destination_offices" FOR DELETE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Office_Insert" ON "public"."destination_offices" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Office_Select" ON "public"."destination_offices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Office_Update" ON "public"."destination_offices" FOR UPDATE TO "authenticated" USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role"));



CREATE POLICY "Prof_Update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR (( SELECT "profiles_1"."role"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = ( SELECT "auth"."uid"() AS "uid"))) = 'admin'::"public"."user_role")));



CREATE POLICY "RoutingLog_Insert" ON "public"."routing_logs" FOR INSERT TO "authenticated" WITH CHECK ((("handled_by" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "routing_logs"."document_id") AND ("documents"."custodian_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "RoutingLog_Select" ON "public"."routing_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE (("documents"."id" = "routing_logs"."document_id") AND ("public"."is_admin"() OR ("documents"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("documents"."custodian_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Select all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Universal Document Read" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can only read logs of documents they can access" ON "public"."document_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."documents"
  WHERE ("documents"."id" = "document_logs"."document_id"))));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."destination_offices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routing_logs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."check_user_routed_doc"("doc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_user_routed_doc"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_routed_doc"("doc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."force_server_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."force_server_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_server_timestamp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_document_access"("doc_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_document_access"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_document_access"("doc_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_log_tampering"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_log_tampering"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_log_tampering"() TO "service_role";



GRANT ALL ON FUNCTION "public"."process_document_action"("p_doc_id" "uuid", "p_log_action" "text", "p_log_location" "text", "p_log_created_by" "uuid", "p_log_assigned_to" "text", "p_log_remarks" "text", "p_log_signature_url" "text", "p_log_attachment_url" "text", "p_new_status" "text", "p_new_location" "text", "p_new_clerk" "text", "p_new_remarks" "text", "p_clear_remarks" boolean, "p_completed_attachment_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_document_action"("p_doc_id" "uuid", "p_log_action" "text", "p_log_location" "text", "p_log_created_by" "uuid", "p_log_assigned_to" "text", "p_log_remarks" "text", "p_log_signature_url" "text", "p_log_attachment_url" "text", "p_new_status" "text", "p_new_location" "text", "p_new_clerk" "text", "p_new_remarks" "text", "p_clear_remarks" boolean, "p_completed_attachment_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_document_action"("p_doc_id" "uuid", "p_log_action" "text", "p_log_location" "text", "p_log_created_by" "uuid", "p_log_assigned_to" "text", "p_log_remarks" "text", "p_log_signature_url" "text", "p_log_attachment_url" "text", "p_new_status" "text", "p_new_location" "text", "p_new_clerk" "text", "p_new_remarks" "text", "p_clear_remarks" boolean, "p_completed_attachment_url" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."route_document"("p_document_id" "uuid", "p_office_id" "uuid", "p_clerk_name" "text", "p_signature_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."route_document"("p_document_id" "uuid", "p_office_id" "uuid", "p_clerk_name" "text", "p_signature_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."route_document"("p_document_id" "uuid", "p_office_id" "uuid", "p_clerk_name" "text", "p_signature_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."destination_offices" TO "anon";
GRANT ALL ON TABLE "public"."destination_offices" TO "authenticated";
GRANT ALL ON TABLE "public"."destination_offices" TO "service_role";



GRANT ALL ON TABLE "public"."document_logs" TO "anon";
GRANT ALL ON TABLE "public"."document_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."document_logs" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."routing_logs" TO "anon";
GRANT ALL ON TABLE "public"."routing_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."routing_logs" TO "service_role";









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































