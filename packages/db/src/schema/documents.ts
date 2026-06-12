import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { SourceTrustMetadata } from "@paperclipai/shared";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    // 'issue' documents are bound to an issue via issue_documents; 'library' documents
    // are standalone company-level artifacts identified by (companyId, slug).
    scope: text("scope").notNull().default("issue"),
    slug: text("slug"),
    path: text("path"),
    // Per-document version retention: 'keep_all' (default) or 'current_only'.
    retentionPolicy: text("retention_policy").notNull().default("keep_all"),
    title: text("title"),
    format: text("format").notNull().default("markdown"),
    latestBody: text("latest_body").notNull(),
    latestRevisionId: uuid("latest_revision_id"),
    latestRevisionNumber: integer("latest_revision_number").notNull().default(1),
    // Pointer to the mirrored current-version file in the storage provider. NULL until
    // first mirror. Flat columns chosen for AI indexing / BigQuery 1:1 mapping.
    mirrorProvider: text("mirror_provider"),
    mirrorObjectKey: text("mirror_object_key"),
    mirrorSha256: text("mirror_sha256"),
    mirrorByteSize: integer("mirror_byte_size"),
    mirrorContentType: text("mirror_content_type"),
    mirroredAt: timestamp("mirrored_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: uuid("updated_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedByAgentId: uuid("locked_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    lockedByUserId: text("locked_by_user_id"),
    sourceTrust: jsonb("source_trust").$type<SourceTrustMetadata | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUpdatedIdx: index("documents_company_updated_idx").on(table.companyId, table.updatedAt),
    companyCreatedIdx: index("documents_company_created_idx").on(table.companyId, table.createdAt),
    companyScopeUpdatedIdx: index("documents_company_scope_updated_idx").on(
      table.companyId,
      table.scope,
      table.updatedAt,
    ),
    // Library slugs are unique per company; issue documents (slug NULL) are unaffected.
    companyScopeSlugUq: uniqueIndex("documents_company_scope_slug_uq")
      .on(table.companyId, table.scope, table.slug)
      .where(sql`${table.scope} = 'library' AND ${table.slug} IS NOT NULL`),
    titleSearchIdx: index("documents_title_search_idx").using("gin", table.title.op("gin_trgm_ops")),
    bodySearchIdx: index("documents_latest_body_search_idx").using("gin", table.latestBody.op("gin_trgm_ops")),
  }),
);
