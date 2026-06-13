ALTER TABLE "companies" ALTER COLUMN "attachment_max_bytes" SET DEFAULT 52428800;--> statement-breakpoint
UPDATE "companies" SET "attachment_max_bytes" = 52428800 WHERE "attachment_max_bytes" = 10485760;
