import { z } from "zod";
import { DOCUMENT_RETENTION_POLICIES } from "../constants.js";
import { issueDocumentFormatSchema } from "./issue.js";
import { multilineTextSchema } from "./text.js";

// Stable, human-facing identifier for a standalone (library) document. Mirrors the
// issue document key rules but allows a longer length for descriptive slugs.
export const documentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Document slug must be lowercase letters, numbers, _ or -");

// Optional folder grouping, e.g. "playbooks/onboarding". Each segment follows slug rules.
export const documentPathSchema = z
  .string()
  .trim()
  .max(256)
  .regex(
    /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/,
    "Document path segments must be lowercase letters, numbers, _ or - separated by /",
  );

export const documentRetentionPolicySchema = z.enum(DOCUMENT_RETENTION_POLICIES);

export const upsertLibraryDocumentSchema = z.object({
  slug: documentSlugSchema,
  path: documentPathSchema.nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  format: issueDocumentFormatSchema,
  body: multilineTextSchema.pipe(z.string().max(524288)),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  baseRevisionId: z.string().uuid().nullable().optional(),
  retentionPolicy: documentRetentionPolicySchema.optional(),
});

export const setDocumentRetentionPolicySchema = z.object({
  policy: documentRetentionPolicySchema,
});

export const restoreDocumentRevisionSchema = z.object({});

export type DocumentRetentionPolicyInput = z.infer<typeof documentRetentionPolicySchema>;
export type UpsertLibraryDocument = z.infer<typeof upsertLibraryDocumentSchema>;
export type SetDocumentRetentionPolicy = z.infer<typeof setDocumentRetentionPolicySchema>;
export type RestoreDocumentRevision = z.infer<typeof restoreDocumentRevisionSchema>;
