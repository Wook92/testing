export const schemaSql = `
CREATE TABLE IF NOT EXISTS "assessments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "name" text,
        "scope" text,
        "score" integer NOT NULL,
        "max_score" integer DEFAULT 100 NOT NULL,
        "assessment_date" date NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attendance_pins" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "pin" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "teacher_check_in_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar,
        "check_in_code" text NOT NULL,
        "sms_recipient_1" text,
        "sms_recipient_2" text,
        "message_template" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "attendance_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "class_id" varchar,
        "check_in_at" timestamp DEFAULT now() NOT NULL,
        "check_in_date" date NOT NULL,
        "was_late" boolean DEFAULT false NOT NULL,
        "late_notification_sent" boolean DEFAULT false NOT NULL,
        "late_notification_sent_at" timestamp,
        "check_in_notification_sent" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "teacher_work_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar,
        "work_date" date NOT NULL,
        "check_in_at" timestamp,
        "check_out_at" timestamp,
        "work_minutes" integer,
        "no_check_out" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "centers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "class_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "class_videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "title" text NOT NULL,
        "youtube_url" text NOT NULL,
        "thumbnail_url" text,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "classes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "subject" text NOT NULL,
        "class_type" text DEFAULT 'regular' NOT NULL,
        "teacher_id" varchar,
        "teacher_name" text,
        "center_id" varchar,
        "classroom" text,
        "days" text[] NOT NULL,
        "start_time" text NOT NULL,
        "end_time" text NOT NULL,
        "schedule" text,
        "color" text DEFAULT '#3B82F6' NOT NULL,
        "is_archived" boolean DEFAULT false NOT NULL,
        "base_fee" integer DEFAULT 0 NOT NULL,
        "additional_fee" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinic_assignment_files" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "step_id" varchar,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "file_type" text NOT NULL,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_assignment_steps" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "step_order" integer NOT NULL,
        "instruction" text NOT NULL,
        "is_completed" boolean DEFAULT false NOT NULL,
        "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "clinic_assignments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "regular_teacher_id" varchar NOT NULL,
        "clinic_teacher_id" varchar,
        "center_id" varchar,
        "assignment_date" date NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_comments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "author_id" varchar NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_daily_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_progress_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "assignment_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "log_date" date NOT NULL,
        "problems_solved" text,
        "stopped_at" text,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_by" varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS "clinic_resources" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "description" text,
        "is_permanent" boolean DEFAULT false NOT NULL,
        "week_start_date" date,
        "uploaded_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_students" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "regular_teacher_id" varchar NOT NULL,
        "clinic_teacher_id" varchar,
        "center_id" varchar,
        "clinic_type" text DEFAULT 'middle' NOT NULL,
        "grade" text,
        "class_group" text,
        "clinic_days" text[] NOT NULL,
        "clinic_time" text,
        "default_instructions" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_instruction_defaults" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "weekday" text NOT NULL,
        "period1_default" text,
        "period2_default" text,
        "period3_default" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_weekly_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clinic_student_id" varchar NOT NULL,
        "week_start_date" date NOT NULL,
        "file_path" text,
        "file_name" text,
        "additional_notes" text,
        "clinic_teacher_feedback" text,
        "progress_notes" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "clinic_day_time_note" text,
        "weekly_evaluation" text,
        "period2_instruction" text,
        "period3_instruction" text,
        "clinic_teacher_notes" text,
        "use_default_period2" boolean DEFAULT true NOT NULL,
        "use_default_period3" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_weekly_record_files" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "record_id" varchar NOT NULL,
        "period" text NOT NULL,
        "file_name" text NOT NULL,
        "file_path" text NOT NULL,
        "file_type" text NOT NULL,
        "file_size" integer,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_shared_instruction_groups" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "teacher_id" varchar NOT NULL,
        "week_start_date" date NOT NULL,
        "period" text NOT NULL,
        "content" text,
        "use_default" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "clinic_shared_instruction_members" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "shared_group_id" varchar NOT NULL,
        "record_id" varchar NOT NULL,
        "joined_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "enrollments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "class_id" varchar NOT NULL,
        "enrolled_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "homework" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar,
        "title" text NOT NULL,
        "due_date" date NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "homework_submissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "homework_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "photos" text[],
        "completion_rate" integer DEFAULT 0,
        "status" text DEFAULT 'pending' NOT NULL,
        "feedback" text,
        "resubmit_reason" text,
        "submitted_at" timestamp,
        "reviewed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "message_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "attendance_record_id" varchar,
        "template_id" varchar,
        "recipient_phone" text NOT NULL,
        "recipient_type" text NOT NULL,
        "message_type" text NOT NULL,
        "channel" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "error_message" text,
        "sent_at" timestamp,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "related_id" varchar,
        "related_type" text,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "solapi_credentials" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "api_key" text NOT NULL,
        "api_secret" text NOT NULL,
        "sender_number" text NOT NULL,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "solapi_credentials_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "student_class_notes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "teacher_id" varchar NOT NULL,
        "note_date" date NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "student_monthly_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "created_by_id" varchar NOT NULL,
        "year" integer NOT NULL,
        "month" integer NOT NULL,
        "report_content" text NOT NULL,
        "custom_instructions" text,
        "assessment_summary" text,
        "attendance_summary" text,
        "homework_summary" text,
        "clinic_summary" text,
        "video_viewing_summary" text,
        "study_cafe_summary" text,
        "sms_sent_at" timestamp,
        "sms_recipients" text,
        "sms_status" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_fixed_seats" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "seat_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "assigned_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_reservations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "seat_id" varchar NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "start_at" timestamp NOT NULL,
        "end_at" timestamp NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_cafe_seats" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "seat_number" integer NOT NULL,
        "row" integer NOT NULL,
        "col" integer NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "study_cafe_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "is_enabled" boolean DEFAULT false NOT NULL,
        "notice" text,
        "entry_password" text,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "study_cafe_settings_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" varchar PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "textbook_videos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "textbook_id" varchar NOT NULL,
        "page_number" integer NOT NULL,
        "problem_number" integer NOT NULL,
        "youtube_url" text NOT NULL,
        "uploaded_by" varchar NOT NULL,
        "uploaded_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "textbooks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "cover_image" text,
        "is_visible" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "todo_assignees" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "todo_id" varchar NOT NULL,
        "assignee_id" varchar NOT NULL,
        "is_completed" boolean DEFAULT false NOT NULL,
        "completed_at" timestamp,
        "completed_for_date" date
);

CREATE TABLE IF NOT EXISTS "todos" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "creator_id" varchar NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "start_date" date,
        "due_date" date NOT NULL,
        "priority" text DEFAULT 'medium' NOT NULL,
        "recurrence" text DEFAULT 'none' NOT NULL,
        "recurrence_anchor_date" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tuition_access_passwords" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "password" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "tuition_access_passwords_student_id_unique" UNIQUE("student_id")
);

CREATE TABLE IF NOT EXISTS "tuition_guidances" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "guidance_text" text,
        "image_urls" text[] DEFAULT '{}',
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "tuition_guidances_center_id_unique" UNIQUE("center_id")
);

CREATE TABLE IF NOT EXISTS "tuition_notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "parent_id" varchar,
        "center_id" varchar,
        "sent_by_id" varchar NOT NULL,
        "calculated_total" integer NOT NULL,
        "sent_amount" integer NOT NULL,
        "fee_breakdown" text,
        "payment_method" text NOT NULL,
        "payment_details" text,
        "message_content" text NOT NULL,
        "recipient_phone" text NOT NULL,
        "recipient_type" text,
        "status" text DEFAULT 'sent' NOT NULL,
        "error_message" text,
        "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_centers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "center_id" varchar
);

CREATE TABLE IF NOT EXISTS "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "mother_phone" text,
        "father_phone" text,
        "school" text,
        "grade" text,
        "role" integer DEFAULT 1 NOT NULL,
        "is_clinic_teacher" boolean DEFAULT false NOT NULL,
        "linked_student_ids" text[],
        "homeroom_teacher_id" varchar,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE IF NOT EXISTS "conversations" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "conversation_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_conversations_id_fk'
  ) THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" 
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

-- Migration: Add missing columns to existing tables
-- These ALTER statements ensure production tables have all required columns

-- classes table: add is_archived, base_fee, additional_fee
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "base_fee" integer DEFAULT 0 NOT NULL;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "additional_fee" integer DEFAULT 0 NOT NULL;

-- homework_submissions table: add status, completion_rate
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'pending' NOT NULL;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "completion_rate" integer DEFAULT 0;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "feedback" text;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "resubmit_reason" text;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;

-- notifications table: add is_read
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" boolean DEFAULT false NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_id" varchar;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_type" text;

-- homework table: add student_id for individual assignments
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "student_id" varchar;

-- attendance_records table: add notification columns
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late_notification_sent_at" timestamp;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_in_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_at" timestamp;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "check_out_notification_sent" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "attendance_status" text DEFAULT 'pending' NOT NULL;

-- clinic_students table: add clinic_type and clinic_time columns for high school vs middle school clinics
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "clinic_type" text DEFAULT 'middle' NOT NULL;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "clinic_time" text;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "grade" text;
ALTER TABLE "clinic_students" ADD COLUMN IF NOT EXISTS "class_group" text;

-- clinic_instruction_defaults table: add period1_default column
ALTER TABLE "clinic_instruction_defaults" ADD COLUMN IF NOT EXISTS "period1_default" text;

-- clinic_weekly_records table: add new columns for enhanced functionality
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "clinic_day_time_note" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "weekly_evaluation" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "period2_instruction" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "period3_instruction" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "clinic_teacher_notes" text;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period2" boolean DEFAULT true NOT NULL;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period3" boolean DEFAULT true NOT NULL;
ALTER TABLE "clinic_weekly_records" ADD COLUMN IF NOT EXISTS "use_default_period1" boolean DEFAULT true NOT NULL;

-- Student Exit Records (학생 퇴원 기록)
CREATE TABLE IF NOT EXISTS "student_exit_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "student_name" text NOT NULL,
        "center_id" varchar,
        "exit_month" text NOT NULL,
        "reasons" text[] NOT NULL,
        "notes" text,
        "recorded_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Monthly Student Snapshots (월별 학생 수 스냅샷)
CREATE TABLE IF NOT EXISTS "monthly_student_snapshots" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "month" text NOT NULL,
        "student_count" integer NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Student Textbook Purchases (학생 교재비)
CREATE TABLE IF NOT EXISTS "student_textbook_purchases" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "center_id" varchar,
        "textbook_name" varchar NOT NULL,
        "price" integer DEFAULT 0 NOT NULL,
        "purchase_date" timestamp DEFAULT now(),
        "notes" text,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Marketing Campaigns (마케팅 캠페인)
CREATE TABLE IF NOT EXISTS "marketing_campaigns" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "name" text NOT NULL,
        "channel" text NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "budget" integer NOT NULL,
        "notes" text,
        "created_by" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);

-- Monthly Financial Records (월별 재무 기록)
CREATE TABLE IF NOT EXISTS "monthly_financial_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "center_id" varchar,
        "year_month" text NOT NULL,
        "revenue_tuition" integer DEFAULT 0 NOT NULL,
        "revenue_tuition_details" text,
        "expense_regular_salary" integer DEFAULT 0 NOT NULL,
        "expense_regular_salary_details" text,
        "expense_part_time_salary" integer DEFAULT 0 NOT NULL,
        "expense_part_time_salary_details" text,
        "expense_hourly_salary" integer DEFAULT 0 NOT NULL,
        "expense_hourly_salary_details" text,
        "expense_employee_insurance" integer DEFAULT 0 NOT NULL,
        "expense_employee_insurance_details" text,
        "expense_rent" integer DEFAULT 0 NOT NULL,
        "expense_rent_details" text,
        "expense_utilities" integer DEFAULT 0 NOT NULL,
        "expense_utilities_details" text,
        "expense_internet" integer DEFAULT 0 NOT NULL,
        "expense_internet_details" text,
        "expense_insurance" integer DEFAULT 0 NOT NULL,
        "expense_insurance_details" text,
        "expense_depreciation" integer DEFAULT 0 NOT NULL,
        "expense_depreciation_details" text,
        "expense_marketing" integer DEFAULT 0 NOT NULL,
        "expense_marketing_details" text,
        "expense_office_supplies" integer DEFAULT 0 NOT NULL,
        "expense_office_supplies_details" text,
        "expense_teaching_materials" integer DEFAULT 0 NOT NULL,
        "expense_teaching_materials_details" text,
        "expense_maintenance" integer DEFAULT 0 NOT NULL,
        "expense_maintenance_details" text,
        "expense_meals" integer DEFAULT 0 NOT NULL,
        "expense_meals_details" text,
        "expense_other" integer DEFAULT 0 NOT NULL,
        "expense_other_details" text,
        "notes" text,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

-- Teacher Salary Settings (선생님 급여 설정)
CREATE TABLE IF NOT EXISTS "teacher_salary_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar,
        "base_salary" integer DEFAULT 0 NOT NULL,
        "class_base_pay" integer DEFAULT 0 NOT NULL,
        "class_base_pay_middle" integer DEFAULT 0 NOT NULL,
        "class_base_pay_high" integer DEFAULT 0 NOT NULL,
        "student_threshold" integer DEFAULT 0 NOT NULL,
        "student_threshold_middle" integer DEFAULT 0 NOT NULL,
        "student_threshold_high" integer DEFAULT 0 NOT NULL,
        "per_student_bonus" integer DEFAULT 0 NOT NULL,
        "per_student_bonus_middle" integer DEFAULT 0 NOT NULL,
        "per_student_bonus_high" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_center_unique" ON "teacher_salary_settings" ("teacher_id", "center_id");

-- Teacher Salary Adjustments (급여 조정 항목)
CREATE TABLE IF NOT EXISTS "teacher_salary_adjustments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "teacher_id" varchar NOT NULL,
        "center_id" varchar,
        "year_month" varchar(7) NOT NULL,
        "amount" integer NOT NULL,
        "description" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "created_by" varchar
);

-- Add missing columns to users table (선생님 고용 형태, 일급)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "daily_rate" integer;

-- Add missing column to classes table (수업 레벨: 중등/고등)
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "class_level" text DEFAULT 'middle' NOT NULL;

-- Add class planning columns to classes table (수업 계획)
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "monthly_plan" text;
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "weekly_plan" text;

-- Fix center_id to be nullable for single-academy mode (all tables that have center_id)
-- Using DO blocks to safely drop NOT NULL constraints without failing if already nullable
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "classes" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "todos" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_records' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "attendance_records" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance_pins' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "attendance_pins" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinic_students' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "clinic_students" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'message_templates' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "message_templates" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_monthly_reports' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "student_monthly_reports" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_work_records' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "teacher_work_records" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "announcements" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinic_assignments' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "clinic_assignments" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinic_resources' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "clinic_resources" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinic_shared_instruction_groups' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "clinic_shared_instruction_groups" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marketing_campaigns' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "marketing_campaigns" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_financial_records' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "monthly_financial_records" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_student_snapshots' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "monthly_student_snapshots" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solapi_credentials' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "solapi_credentials" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_exit_records' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "student_exit_records" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_textbook_purchases' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "student_textbook_purchases" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_cafe_fixed_seats' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "study_cafe_fixed_seats" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_cafe_reservations' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "study_cafe_reservations" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_cafe_seats' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "study_cafe_seats" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_cafe_settings' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "study_cafe_settings" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_check_in_settings' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "teacher_check_in_settings" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_salary_adjustments' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "teacher_salary_adjustments" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_salary_settings' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "teacher_salary_settings" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tuition_guidances' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "tuition_guidances" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tuition_notifications' AND column_name = 'center_id' AND is_nullable = 'NO') THEN
        ALTER TABLE "tuition_notifications" ALTER COLUMN "center_id" DROP NOT NULL;
    END IF;
END $$;

-- Student Points (학생 포인트)
CREATE TABLE IF NOT EXISTS "student_points" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL UNIQUE,
        "total_points" integer DEFAULT 0 NOT NULL,
        "available_points" integer DEFAULT 0 NOT NULL
);

-- Point Transactions (포인트 내역)
CREATE TABLE IF NOT EXISTS "point_transactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "student_id" varchar NOT NULL,
        "amount" integer NOT NULL,
        "type" text NOT NULL,
        "description" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "created_by" varchar
);

-- Class Plans (수업 계획)
CREATE TABLE IF NOT EXISTS "class_plans" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "class_id" varchar NOT NULL,
        "plan_type" text NOT NULL,
        "period_start" date NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "created_by" varchar
);

-- Announcements (공지사항)
CREATE TABLE IF NOT EXISTS "announcements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "created_by_id" varchar NOT NULL,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "target_type" text NOT NULL,
        "target_ids" text[] NOT NULL,
        "sms_sent_at" timestamp,
        "sms_status" text,
        "sms_recipients" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

-- Calendar Events (학원 캘린더)
CREATE TABLE IF NOT EXISTS "calendar_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "event_type" text NOT NULL DEFAULT 'academy_event',
        "school_name" text,
        "start_date" date NOT NULL,
        "end_date" date,
        "color" text,
        "created_by_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);

-- Add missing columns to assessments table
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "assessments" ADD COLUMN IF NOT EXISTS "scope" text;

-- Add missing columns to calendar_events table
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "event_type" text DEFAULT 'academy_event';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "school_name" text;
-- Rename created_by to created_by_id if needed (safe migration)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'created_by') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'created_by_id') THEN
        ALTER TABLE "calendar_events" RENAME COLUMN "created_by" TO "created_by_id";
    END IF;
END $$;
`;
