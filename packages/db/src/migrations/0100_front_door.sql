CREATE TABLE IF NOT EXISTS "fd_employee_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"title" text,
	"department" text,
	"reports_to_name" text,
	"learned" jsonb DEFAULT '{"interests":[],"priorities":[],"communicationStyle":"","notes":[]}'::jsonb NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"last_session_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_agent_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"agent_id" uuid,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"persona" text NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"avatar" jsonb NOT NULL,
	"voice" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"active_agent_slug" text DEFAULT 'ceo' NOT NULL,
	"title" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fd_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"agent_slug" text,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "fd_agent_profiles" ADD CONSTRAINT "fd_agent_profiles_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_sessions" ADD CONSTRAINT "fd_sessions_profile_id_fd_employee_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."fd_employee_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fd_messages" ADD CONSTRAINT "fd_messages_session_id_fd_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fd_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fd_employee_profiles_email_idx" ON "fd_employee_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fd_agent_profiles_slug_idx" ON "fd_agent_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_sessions_profile_idx" ON "fd_sessions" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fd_messages_session_seq_idx" ON "fd_messages" USING btree ("session_id","seq");
