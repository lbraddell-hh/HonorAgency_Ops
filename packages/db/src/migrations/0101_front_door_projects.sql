CREATE TABLE IF NOT EXISTS "fd_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"scope" jsonb DEFAULT '{"deliverables":[],"timeline":"","successCriteria":[],"constraints":"","notes":""}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" text DEFAULT 'collaborator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_session_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_slug" text NOT NULL,
	"responsibility" text NOT NULL,
	"paperclip_issue_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "fd_attachments" ADD CONSTRAINT "fd_attachments_session_id_fd_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fd_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_attachments" ADD CONSTRAINT "fd_attachments_profile_id_fd_employee_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."fd_employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_projects" ADD CONSTRAINT "fd_projects_created_by_profile_id_fd_employee_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."fd_employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_project_members" ADD CONSTRAINT "fd_project_members_project_id_fd_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."fd_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_project_members" ADD CONSTRAINT "fd_project_members_profile_id_fd_employee_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."fd_employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_session_projects" ADD CONSTRAINT "fd_session_projects_session_id_fd_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fd_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_session_projects" ADD CONSTRAINT "fd_session_projects_project_id_fd_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."fd_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_project_tasks" ADD CONSTRAINT "fd_project_tasks_project_id_fd_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."fd_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_attachments_session_idx" ON "fd_attachments" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_projects_status_idx" ON "fd_projects" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fd_project_members_uq" ON "fd_project_members" USING btree ("project_id","profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_project_members_profile_idx" ON "fd_project_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fd_session_projects_uq" ON "fd_session_projects" USING btree ("session_id","project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_session_projects_project_idx" ON "fd_session_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_project_tasks_project_idx" ON "fd_project_tasks" USING btree ("project_id");
