ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'issue' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "path" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "retention_policy" text DEFAULT 'keep_all' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirror_provider" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirror_object_key" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirror_sha256" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirror_byte_size" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirror_content_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mirrored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirror_provider" text;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirror_object_key" text;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirror_sha256" text;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirror_byte_size" integer;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirror_content_type" text;--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN IF NOT EXISTS "mirrored_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_company_scope_updated_idx" ON "documents" USING btree ("company_id","scope","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_company_scope_slug_uq" ON "documents" USING btree ("company_id","scope","slug") WHERE "documents"."scope" = 'library' AND "documents"."slug" IS NOT NULL;
