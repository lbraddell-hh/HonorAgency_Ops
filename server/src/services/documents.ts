import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  documentRevisions,
  documents,
  documentAnnotationThreads,
  documentAnnotationAnchorSnapshots,
  issueDocuments,
  issues,
} from "@paperclipai/db";
import {
  isSystemIssueDocumentKey,
  issueDocumentKeySchema,
  type DocumentRetentionPolicy,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface DocumentMirrorPointer {
  provider: string;
  objectKey: string;
  sha256: string;
  byteSize: number;
  contentType: string;
}

const libraryDocumentSelect = {
  id: documents.id,
  companyId: documents.companyId,
  scope: documents.scope,
  slug: documents.slug,
  path: documents.path,
  retentionPolicy: documents.retentionPolicy,
  title: documents.title,
  format: documents.format,
  latestBody: documents.latestBody,
  latestRevisionId: documents.latestRevisionId,
  latestRevisionNumber: documents.latestRevisionNumber,
  mirrorProvider: documents.mirrorProvider,
  mirrorObjectKey: documents.mirrorObjectKey,
  mirrorSha256: documents.mirrorSha256,
  mirrorByteSize: documents.mirrorByteSize,
  mirrorContentType: documents.mirrorContentType,
  mirroredAt: documents.mirroredAt,
  createdByAgentId: documents.createdByAgentId,
  createdByUserId: documents.createdByUserId,
  updatedByAgentId: documents.updatedByAgentId,
  updatedByUserId: documents.updatedByUserId,
  lockedAt: documents.lockedAt,
  lockedByAgentId: documents.lockedByAgentId,
  lockedByUserId: documents.lockedByUserId,
  sourceTrust: documents.sourceTrust,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

function mapLibraryDocumentRow(row: typeof documents.$inferSelect, includeBody: boolean) {
  return {
    id: row.id,
    companyId: row.companyId,
    scope: row.scope,
    slug: row.slug,
    path: row.path,
    retentionPolicy: row.retentionPolicy as DocumentRetentionPolicy,
    title: row.title,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    mirrorProvider: row.mirrorProvider,
    mirrorObjectKey: row.mirrorObjectKey,
    mirrorSha256: row.mirrorSha256,
    mirrorByteSize: row.mirrorByteSize,
    mirrorContentType: row.mirrorContentType,
    mirroredAt: row.mirroredAt,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    lockedAt: row.lockedAt,
    lockedByAgentId: row.lockedByAgentId,
    lockedByUserId: row.lockedByUserId,
    sourceTrust: row.sourceTrust ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeDocumentKey(key: string) {
  const normalized = key.trim().toLowerCase();
  const parsed = issueDocumentKeySchema.safeParse(normalized);
  if (!parsed.success) {
    throw unprocessable("Invalid document key", parsed.error.issues);
  }
  return parsed.data;
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505";
}

function nextAvailableDocumentKey(sourceKey: string, existingKeys: string[]) {
  const usedKeys = new Set(existingKeys);
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const baseMaxLength = 64 - suffix.length;
    const base = sourceKey.slice(0, baseMaxLength).replace(/[-_]+$/g, "") || "document";
    const candidate = `${base}${suffix}`;
    if (!usedKeys.has(candidate) && issueDocumentKeySchema.safeParse(candidate).success) {
      return candidate;
    }
  }
  throw conflict("Unable to choose a new document key for locked document", { key: sourceKey });
}

export function extractLegacyPlanBody(description: string | null | undefined) {
  if (!description) return null;
  const match = /<plan>\s*([\s\S]*?)\s*<\/plan>/i.exec(description);
  if (!match) return null;
  const body = match[1]?.trim();
  return body ? body : null;
}

function mapIssueDocumentRow(
  row: {
    id: string;
    companyId: string;
    issueId: string;
    key: string;
    title: string | null;
    format: string;
    latestBody: string;
    latestRevisionId: string | null;
    latestRevisionNumber: number;
    createdByAgentId: string | null;
    createdByUserId: string | null;
    updatedByAgentId: string | null;
    updatedByUserId: string | null;
    lockedAt: Date | null;
    lockedByAgentId: string | null;
    lockedByUserId: string | null;
    sourceTrust: typeof documents.$inferSelect.sourceTrust;
    createdAt: Date;
    updatedAt: Date;
  },
  includeBody: boolean,
) {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    key: row.key,
    title: row.title,
    format: row.format,
    ...(includeBody ? { body: row.latestBody } : {}),
    latestRevisionId: row.latestRevisionId ?? null,
    latestRevisionNumber: row.latestRevisionNumber,
    createdByAgentId: row.createdByAgentId,
    createdByUserId: row.createdByUserId,
    updatedByAgentId: row.updatedByAgentId,
    updatedByUserId: row.updatedByUserId,
    lockedAt: row.lockedAt,
    lockedByAgentId: row.lockedByAgentId,
    lockedByUserId: row.lockedByUserId,
    sourceTrust: row.sourceTrust ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const issueDocumentSelect = {
  id: documents.id,
  companyId: documents.companyId,
  issueId: issueDocuments.issueId,
  key: issueDocuments.key,
  title: documents.title,
  format: documents.format,
  latestBody: documents.latestBody,
  latestRevisionId: documents.latestRevisionId,
  latestRevisionNumber: documents.latestRevisionNumber,
  createdByAgentId: documents.createdByAgentId,
  createdByUserId: documents.createdByUserId,
  updatedByAgentId: documents.updatedByAgentId,
  updatedByUserId: documents.updatedByUserId,
  lockedAt: documents.lockedAt,
  lockedByAgentId: documents.lockedByAgentId,
  lockedByUserId: documents.lockedByUserId,
  sourceTrust: documents.sourceTrust,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

type DocumentTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Re-point annotation threads off the given (about-to-be-removed) revisions onto the
 * document's latest revision, and delete anchor snapshots that reference them. The
 * thread/snapshot FKs are onDelete:set null, so without this NULLs would silently appear.
 * No-op for library documents (which have no annotation threads).
 */
async function cleanupAnnotationsForRevisions(
  tx: DocumentTx,
  documentId: string,
  revisionIds: string[],
  latest: { id: string | null; number: number },
): Promise<void> {
  if (revisionIds.length === 0) return;
  if (latest.id) {
    await tx
      .update(documentAnnotationThreads)
      .set({ currentRevisionId: latest.id, currentRevisionNumber: latest.number })
      .where(
        and(
          eq(documentAnnotationThreads.documentId, documentId),
          inArray(documentAnnotationThreads.currentRevisionId, revisionIds),
        ),
      );
  }
  await tx.delete(documentAnnotationAnchorSnapshots).where(
    and(
      eq(documentAnnotationAnchorSnapshots.documentId, documentId),
      or(
        inArray(documentAnnotationAnchorSnapshots.fromRevisionId, revisionIds),
        inArray(documentAnnotationAnchorSnapshots.toRevisionId, revisionIds),
      ),
    ),
  );
  // originalRevisionId on threads auto-nulls via the FK onDelete:set null when the row goes.
}

/** Delete every revision of a document except the latest, returning the pruned rows. */
async function pruneNonLatestRevisions(
  tx: DocumentTx,
  doc: { id: string; latestRevisionId: string | null; latestRevisionNumber: number },
): Promise<{ id: string; revisionNumber: number; mirrorObjectKey: string | null }[]> {
  if (!doc.latestRevisionId) return [];
  const toDelete = await tx
    .select({
      id: documentRevisions.id,
      revisionNumber: documentRevisions.revisionNumber,
      mirrorObjectKey: documentRevisions.mirrorObjectKey,
    })
    .from(documentRevisions)
    .where(and(eq(documentRevisions.documentId, doc.id), ne(documentRevisions.id, doc.latestRevisionId)));
  if (toDelete.length === 0) return [];
  const ids = toDelete.map((row) => row.id);
  await cleanupAnnotationsForRevisions(tx, doc.id, ids, {
    id: doc.latestRevisionId,
    number: doc.latestRevisionNumber,
  });
  await tx.delete(documentRevisions).where(inArray(documentRevisions.id, ids));
  return toDelete;
}

export function documentService(db: Db) {
  const filterSystemDocuments = <T extends { key: string }>(rows: T[], includeSystem: boolean) =>
    includeSystem ? rows : rows.filter((row) => !isSystemIssueDocumentKey(row.key));

  return {
    getIssueDocumentPayload: async (
      issue: { id: string; description: string | null },
      options: { includeSystem?: boolean } = {},
    ) => {
      const [planDocument, documentSummaries] = await Promise.all([
        db
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, "plan")))
          .then((rows) => rows[0] ?? null),
        db
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(eq(issueDocuments.issueId, issue.id))
          .orderBy(asc(issueDocuments.key), desc(documents.updatedAt)),
      ]);

      const legacyPlanBody = planDocument ? null : extractLegacyPlanBody(issue.description);

      return {
        planDocument: planDocument ? mapIssueDocumentRow(planDocument, true) : null,
        documentSummaries: filterSystemDocuments(documentSummaries, options.includeSystem ?? false)
          .map((row) => mapIssueDocumentRow(row, false)),
        legacyPlanDocument: legacyPlanBody
          ? {
              key: "plan" as const,
              body: legacyPlanBody,
              source: "issue_description" as const,
            }
          : null,
      };
    },

    listIssueDocuments: async (issueId: string, options: { includeSystem?: boolean } = {}) => {
      const rows = await db
        .select(issueDocumentSelect)
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(eq(issueDocuments.issueId, issueId))
        .orderBy(asc(issueDocuments.key), desc(documents.updatedAt));
      return filterSystemDocuments(rows, options.includeSystem ?? false).map((row) => mapIssueDocumentRow(row, true));
    },

    getIssueDocumentByKey: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      const row = await db
        .select(issueDocumentSelect)
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .then((rows) => rows[0] ?? null);
      return row ? mapIssueDocumentRow(row, true) : null;
    },

    listIssueDocumentRevisions: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          issueId: issueDocuments.issueId,
          key: issueDocuments.key,
          revisionNumber: documentRevisions.revisionNumber,
          title: documentRevisions.title,
          format: documentRevisions.format,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(issueDocuments)
        .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
        .innerJoin(documentRevisions, eq(documentRevisions.documentId, documents.id))
        .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    upsertIssueDocument: async (input: {
      issueId: string;
      key: string;
      title?: string | null;
      format: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
      createdByRunId?: string | null;
      sourceTrust?: typeof documents.$inferInsert.sourceTrust;
      lockedDocumentStrategy?: "conflict" | "create_new_document";
    }) => {
      const key = normalizeDocumentKey(input.key);
      const issue = await db
        .select({ id: issues.id, companyId: issues.companyId })
        .from(issues)
        .where(eq(issues.id, input.issueId))
        .then((rows) => rows[0] ?? null);
      if (!issue) throw notFound("Issue not found");

      const maxAttempts = input.lockedDocumentStrategy === "create_new_document" ? 3 : 1;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          return await db.transaction(async (tx) => {
          const now = new Date();
          const existing = await tx
            .select({
              id: documents.id,
              companyId: documents.companyId,
              issueId: issueDocuments.issueId,
              key: issueDocuments.key,
              title: documents.title,
              format: documents.format,
              latestBody: documents.latestBody,
              latestRevisionId: documents.latestRevisionId,
              latestRevisionNumber: documents.latestRevisionNumber,
              createdByAgentId: documents.createdByAgentId,
              createdByUserId: documents.createdByUserId,
              updatedByAgentId: documents.updatedByAgentId,
              updatedByUserId: documents.updatedByUserId,
              lockedAt: documents.lockedAt,
              lockedByAgentId: documents.lockedByAgentId,
              lockedByUserId: documents.lockedByUserId,
              sourceTrust: documents.sourceTrust,
              createdAt: documents.createdAt,
              updatedAt: documents.updatedAt,
            })
            .from(issueDocuments)
            .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
            .where(and(eq(issueDocuments.issueId, issue.id), eq(issueDocuments.key, key)))
            .then((rows) => rows[0] ?? null);

          if (existing) {
            if (existing.lockedAt) {
              if (input.lockedDocumentStrategy === "create_new_document") {
                const issueDocumentKeys = await tx
                  .select({ key: issueDocuments.key })
                  .from(issueDocuments)
                  .where(eq(issueDocuments.issueId, issue.id));
                const fallbackKey = nextAvailableDocumentKey(key, issueDocumentKeys.map((row) => row.key));

                const [document] = await tx
                  .insert(documents)
                  .values({
                    companyId: issue.companyId,
                    title: input.title ?? null,
                    format: input.format,
                    latestBody: input.body,
                    latestRevisionId: null,
                    latestRevisionNumber: 1,
                    createdByAgentId: input.createdByAgentId ?? null,
                    createdByUserId: input.createdByUserId ?? null,
                    updatedByAgentId: input.createdByAgentId ?? null,
                    updatedByUserId: input.createdByUserId ?? null,
                    lockedAt: null,
                    lockedByAgentId: null,
                    lockedByUserId: null,
                    sourceTrust: input.sourceTrust ?? null,
                    createdAt: now,
                    updatedAt: now,
                  })
                  .returning();

                const [revision] = await tx
                  .insert(documentRevisions)
                  .values({
                    companyId: issue.companyId,
                    documentId: document.id,
                    revisionNumber: 1,
                    title: input.title ?? null,
                    format: input.format,
                    body: input.body,
                    changeSummary: input.changeSummary ?? null,
                    createdByAgentId: input.createdByAgentId ?? null,
                    createdByUserId: input.createdByUserId ?? null,
                    createdByRunId: input.createdByRunId ?? null,
                    createdAt: now,
                  })
                  .returning();

                await tx
                  .update(documents)
                  .set({ latestRevisionId: revision.id })
                  .where(eq(documents.id, document.id));

                await tx.insert(issueDocuments).values({
                  companyId: issue.companyId,
                  issueId: issue.id,
                  documentId: document.id,
                  key: fallbackKey,
                  createdAt: now,
                  updatedAt: now,
                });

                return {
                  created: true as const,
                  redirectedFromLockedDocument: {
                    id: existing.id,
                    key: existing.key,
                  },
                  document: {
                    id: document.id,
                    companyId: issue.companyId,
                    issueId: issue.id,
                    key: fallbackKey,
                    title: document.title,
                    format: document.format,
                    body: document.latestBody,
                    latestRevisionId: revision.id,
                    latestRevisionNumber: 1,
                    createdByAgentId: document.createdByAgentId,
                    createdByUserId: document.createdByUserId,
                    updatedByAgentId: document.updatedByAgentId,
                    updatedByUserId: document.updatedByUserId,
                    lockedAt: null,
                    lockedByAgentId: null,
                    lockedByUserId: null,
                    sourceTrust: document.sourceTrust ?? null,
                    createdAt: document.createdAt,
                    updatedAt: document.updatedAt,
                  },
                };
              }

              throw conflict("Document is locked", {
                key: existing.key,
                documentId: existing.id,
                lockedAt: existing.lockedAt,
              });
            }

            if (!input.baseRevisionId) {
              throw conflict("Document update requires baseRevisionId", {
                currentRevisionId: existing.latestRevisionId,
              });
            }
            if (input.baseRevisionId !== existing.latestRevisionId) {
              throw conflict("Document was updated by someone else", {
                currentRevisionId: existing.latestRevisionId,
              });
            }

            const nextRevisionNumber = existing.latestRevisionNumber + 1;
            const [revision] = await tx
              .insert(documentRevisions)
              .values({
                companyId: issue.companyId,
                documentId: existing.id,
                revisionNumber: nextRevisionNumber,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                changeSummary: input.changeSummary ?? null,
                createdByAgentId: input.createdByAgentId ?? null,
                createdByUserId: input.createdByUserId ?? null,
                createdByRunId: input.createdByRunId ?? null,
                createdAt: now,
              })
              .returning();

            await tx
              .update(documents)
              .set({
                title: input.title ?? null,
                format: input.format,
                latestBody: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                sourceTrust: input.sourceTrust ?? null,
                updatedAt: now,
              })
              .where(eq(documents.id, existing.id));

            await tx
              .update(issueDocuments)
              .set({ updatedAt: now })
              .where(eq(issueDocuments.documentId, existing.id));

            return {
              created: false as const,
              document: {
                ...existing,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                lockedAt: existing.lockedAt,
                lockedByAgentId: existing.lockedByAgentId,
                lockedByUserId: existing.lockedByUserId,
                sourceTrust: input.sourceTrust ?? null,
                updatedAt: now,
              },
            };
          }

          if (input.baseRevisionId) {
            throw conflict("Document does not exist yet", { key });
          }

          const [document] = await tx
            .insert(documents)
            .values({
              companyId: issue.companyId,
              title: input.title ?? null,
              format: input.format,
              latestBody: input.body,
              latestRevisionId: null,
              latestRevisionNumber: 1,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              lockedAt: null,
              lockedByAgentId: null,
              lockedByUserId: null,
              sourceTrust: input.sourceTrust ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: issue.companyId,
              documentId: document.id,
              revisionNumber: 1,
              title: input.title ?? null,
              format: input.format,
              body: input.body,
              changeSummary: input.changeSummary ?? null,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              createdByRunId: input.createdByRunId ?? null,
              createdAt: now,
            })
            .returning();

          await tx
            .update(documents)
            .set({ latestRevisionId: revision.id })
            .where(eq(documents.id, document.id));

          await tx.insert(issueDocuments).values({
            companyId: issue.companyId,
            issueId: issue.id,
            documentId: document.id,
            key,
            createdAt: now,
            updatedAt: now,
          });

          return {
            created: true as const,
            document: {
              id: document.id,
              companyId: issue.companyId,
              issueId: issue.id,
              key,
              title: document.title,
              format: document.format,
              body: document.latestBody,
              latestRevisionId: revision.id,
              latestRevisionNumber: 1,
              createdByAgentId: document.createdByAgentId,
              createdByUserId: document.createdByUserId,
              updatedByAgentId: document.updatedByAgentId,
              updatedByUserId: document.updatedByUserId,
              lockedAt: document.lockedAt,
              lockedByAgentId: document.lockedByAgentId,
              lockedByUserId: document.lockedByUserId,
              sourceTrust: document.sourceTrust ?? null,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            },
          };
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            if (input.lockedDocumentStrategy === "create_new_document" && attempt < maxAttempts - 1) {
              continue;
            }
            throw conflict("Document key already exists on this issue", { key });
          }
          throw error;
        }
      }

      throw conflict("Unable to choose a new document key for locked document", { key });
    },

    restoreIssueDocumentRevision: async (input: {
      issueId: string;
      key: string;
      revisionId: string;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      const key = normalizeDocumentKey(input.key);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, input.issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) throw notFound("Document not found");
        if (existing.lockedAt) {
          throw conflict("Document is locked", {
            key: existing.key,
            documentId: existing.id,
            lockedAt: existing.lockedAt,
          });
        }

        const revision = await tx
          .select({
            id: documentRevisions.id,
            companyId: documentRevisions.companyId,
            documentId: documentRevisions.documentId,
            revisionNumber: documentRevisions.revisionNumber,
            title: documentRevisions.title,
            format: documentRevisions.format,
            body: documentRevisions.body,
          })
          .from(documentRevisions)
          .where(and(eq(documentRevisions.id, input.revisionId), eq(documentRevisions.documentId, existing.id)))
          .then((rows) => rows[0] ?? null);

        if (!revision) throw notFound("Document revision not found");
        if (existing.latestRevisionId === revision.id) {
          throw conflict("Selected revision is already the latest revision", {
            currentRevisionId: existing.latestRevisionId,
          });
        }

        const now = new Date();
        const nextRevisionNumber = existing.latestRevisionNumber + 1;
        const [restoredRevision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: existing.companyId,
            documentId: existing.id,
            revisionNumber: nextRevisionNumber,
            title: revision.title ?? null,
            format: revision.format,
            body: revision.body,
            changeSummary: `Restored from revision ${revision.revisionNumber}`,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        await tx
          .update(documents)
          .set({
            title: revision.title ?? null,
            format: revision.format,
            latestBody: revision.body,
            latestRevisionId: restoredRevision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id));

        await tx
          .update(issueDocuments)
          .set({ updatedAt: now })
          .where(eq(issueDocuments.documentId, existing.id));

        return {
          restoredFromRevisionId: revision.id,
          restoredFromRevisionNumber: revision.revisionNumber,
          document: {
            ...existing,
            title: revision.title ?? null,
            format: revision.format,
            body: revision.body,
            latestRevisionId: restoredRevision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          },
        };
      });
    },

    lockIssueDocument: async (input: {
      issueId: string;
      key: string;
      lockedByAgentId?: string | null;
      lockedByUserId?: string | null;
    }) => {
      const key = normalizeDocumentKey(input.key);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, input.issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) throw notFound("Document not found");
        if (existing.lockedAt) {
          return {
            changed: false as const,
            document: mapIssueDocumentRow(existing, true),
          };
        }

        const now = new Date();
        await tx
          .update(documents)
          .set({
            lockedAt: now,
            lockedByAgentId: input.lockedByAgentId ?? null,
            lockedByUserId: input.lockedByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id));

        await tx
          .update(issueDocuments)
          .set({ updatedAt: now })
          .where(eq(issueDocuments.documentId, existing.id));

        return {
          changed: true as const,
          document: {
            ...mapIssueDocumentRow(existing, true),
            lockedAt: now,
            lockedByAgentId: input.lockedByAgentId ?? null,
            lockedByUserId: input.lockedByUserId ?? null,
            updatedAt: now,
          },
        };
      });
    },

    unlockIssueDocument: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) throw notFound("Document not found");
        if (!existing.lockedAt) {
          return {
            changed: false as const,
            document: mapIssueDocumentRow(existing, true),
          };
        }

        const now = new Date();
        await tx
          .update(documents)
          .set({
            lockedAt: null,
            lockedByAgentId: null,
            lockedByUserId: null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id));

        await tx
          .update(issueDocuments)
          .set({ updatedAt: now })
          .where(eq(issueDocuments.documentId, existing.id));

        return {
          changed: true as const,
          document: {
            ...mapIssueDocumentRow(existing, true),
            lockedAt: null,
            lockedByAgentId: null,
            lockedByUserId: null,
            updatedAt: now,
          },
        };
      });
    },

    deleteIssueDocument: async (issueId: string, rawKey: string) => {
      const key = normalizeDocumentKey(rawKey);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(issueDocumentSelect)
          .from(issueDocuments)
          .innerJoin(documents, eq(issueDocuments.documentId, documents.id))
          .where(and(eq(issueDocuments.issueId, issueId), eq(issueDocuments.key, key)))
          .then((rows) => rows[0] ?? null);

        if (!existing) return null;
        if (existing.lockedAt) {
          throw conflict("Document is locked", {
            key: existing.key,
            documentId: existing.id,
            lockedAt: existing.lockedAt,
          });
        }

        await tx.delete(issueDocuments).where(eq(issueDocuments.documentId, existing.id));
        await tx.delete(documents).where(eq(documents.id, existing.id));

        return {
          ...existing,
          body: existing.latestBody,
          latestRevisionId: existing.latestRevisionId ?? null,
        };
      });
    },

    // ---- Standalone (library) documents ----

    listLibraryDocuments: async (companyId: string, options: { path?: string | null } = {}) => {
      const conditions = [eq(documents.companyId, companyId), eq(documents.scope, "library")];
      if (options.path) conditions.push(eq(documents.path, options.path));
      const rows = await db
        .select(libraryDocumentSelect)
        .from(documents)
        .where(and(...conditions))
        .orderBy(asc(documents.path), desc(documents.updatedAt));
      return rows.map((row) => mapLibraryDocumentRow(row, false));
    },

    getLibraryDocument: async (companyId: string, slug: string) => {
      const row = await db
        .select(libraryDocumentSelect)
        .from(documents)
        .where(and(eq(documents.companyId, companyId), eq(documents.scope, "library"), eq(documents.slug, slug)))
        .then((rows) => rows[0] ?? null);
      return row ? mapLibraryDocumentRow(row, true) : null;
    },

    listLibraryDocumentRevisions: async (companyId: string, slug: string) => {
      return db
        .select({
          id: documentRevisions.id,
          companyId: documentRevisions.companyId,
          documentId: documentRevisions.documentId,
          revisionNumber: documentRevisions.revisionNumber,
          title: documentRevisions.title,
          format: documentRevisions.format,
          body: documentRevisions.body,
          changeSummary: documentRevisions.changeSummary,
          mirrorProvider: documentRevisions.mirrorProvider,
          mirrorObjectKey: documentRevisions.mirrorObjectKey,
          mirrorSha256: documentRevisions.mirrorSha256,
          mirroredAt: documentRevisions.mirroredAt,
          createdByAgentId: documentRevisions.createdByAgentId,
          createdByUserId: documentRevisions.createdByUserId,
          createdAt: documentRevisions.createdAt,
        })
        .from(documentRevisions)
        .innerJoin(documents, eq(documentRevisions.documentId, documents.id))
        .where(and(eq(documents.companyId, companyId), eq(documents.scope, "library"), eq(documents.slug, slug)))
        .orderBy(desc(documentRevisions.revisionNumber));
    },

    upsertLibraryDocument: async (input: {
      companyId: string;
      slug: string;
      path?: string | null;
      title?: string | null;
      format: string;
      body: string;
      changeSummary?: string | null;
      baseRevisionId?: string | null;
      retentionPolicy?: DocumentRetentionPolicy;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
      createdByRunId?: string | null;
      sourceTrust?: typeof documents.$inferInsert.sourceTrust;
    }) => {
      try {
        return await db.transaction(async (tx) => {
          const now = new Date();
          const existing = await tx
            .select(libraryDocumentSelect)
            .from(documents)
            .where(
              and(
                eq(documents.companyId, input.companyId),
                eq(documents.scope, "library"),
                eq(documents.slug, input.slug),
              ),
            )
            .then((rows) => rows[0] ?? null);

          if (existing) {
            if (existing.lockedAt) {
              throw conflict("Document is locked", { slug: input.slug, documentId: existing.id });
            }
            if (!input.baseRevisionId) {
              throw conflict("Document update requires baseRevisionId", {
                currentRevisionId: existing.latestRevisionId,
              });
            }
            if (input.baseRevisionId !== existing.latestRevisionId) {
              throw conflict("Document was updated by someone else", {
                currentRevisionId: existing.latestRevisionId,
              });
            }

            const nextRevisionNumber = existing.latestRevisionNumber + 1;
            const [revision] = await tx
              .insert(documentRevisions)
              .values({
                companyId: input.companyId,
                documentId: existing.id,
                revisionNumber: nextRevisionNumber,
                title: input.title ?? null,
                format: input.format,
                body: input.body,
                changeSummary: input.changeSummary ?? null,
                createdByAgentId: input.createdByAgentId ?? null,
                createdByUserId: input.createdByUserId ?? null,
                createdByRunId: input.createdByRunId ?? null,
                createdAt: now,
              })
              .returning();

            const [updated] = await tx
              .update(documents)
              .set({
                title: input.title ?? null,
                format: input.format,
                latestBody: input.body,
                latestRevisionId: revision.id,
                latestRevisionNumber: nextRevisionNumber,
                path: input.path === undefined ? existing.path : input.path,
                retentionPolicy: input.retentionPolicy ?? existing.retentionPolicy,
                updatedByAgentId: input.createdByAgentId ?? null,
                updatedByUserId: input.createdByUserId ?? null,
                sourceTrust: input.sourceTrust ?? null,
                updatedAt: now,
              })
              .where(eq(documents.id, existing.id))
              .returning();

            return {
              created: false as const,
              document: mapLibraryDocumentRow(updated, true),
              revision: { id: revision.id, revisionNumber: nextRevisionNumber, body: input.body },
            };
          }

          if (input.baseRevisionId) {
            throw conflict("Document does not exist yet", { slug: input.slug });
          }

          const [document] = await tx
            .insert(documents)
            .values({
              companyId: input.companyId,
              scope: "library",
              slug: input.slug,
              path: input.path ?? null,
              retentionPolicy: input.retentionPolicy ?? "keep_all",
              title: input.title ?? null,
              format: input.format,
              latestBody: input.body,
              latestRevisionId: null,
              latestRevisionNumber: 1,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              updatedByAgentId: input.createdByAgentId ?? null,
              updatedByUserId: input.createdByUserId ?? null,
              sourceTrust: input.sourceTrust ?? null,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [revision] = await tx
            .insert(documentRevisions)
            .values({
              companyId: input.companyId,
              documentId: document.id,
              revisionNumber: 1,
              title: input.title ?? null,
              format: input.format,
              body: input.body,
              changeSummary: input.changeSummary ?? null,
              createdByAgentId: input.createdByAgentId ?? null,
              createdByUserId: input.createdByUserId ?? null,
              createdByRunId: input.createdByRunId ?? null,
              createdAt: now,
            })
            .returning();

          const [withRevision] = await tx
            .update(documents)
            .set({ latestRevisionId: revision.id })
            .where(eq(documents.id, document.id))
            .returning();

          return {
            created: true as const,
            document: mapLibraryDocumentRow(withRevision, true),
            revision: { id: revision.id, revisionNumber: 1, body: input.body },
          };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("A document with this slug already exists", { slug: input.slug });
        }
        throw error;
      }
    },

    restoreLibraryDocumentRevision: async (input: {
      companyId: string;
      slug: string;
      revisionId: string;
      createdByAgentId?: string | null;
      createdByUserId?: string | null;
    }) => {
      return db.transaction(async (tx) => {
        const existing = await tx
          .select(libraryDocumentSelect)
          .from(documents)
          .where(
            and(
              eq(documents.companyId, input.companyId),
              eq(documents.scope, "library"),
              eq(documents.slug, input.slug),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (!existing) throw notFound("Document not found");
        if (existing.lockedAt) {
          throw conflict("Document is locked", { slug: input.slug, documentId: existing.id });
        }

        const revision = await tx
          .select({
            id: documentRevisions.id,
            revisionNumber: documentRevisions.revisionNumber,
            title: documentRevisions.title,
            format: documentRevisions.format,
            body: documentRevisions.body,
          })
          .from(documentRevisions)
          .where(and(eq(documentRevisions.id, input.revisionId), eq(documentRevisions.documentId, existing.id)))
          .then((rows) => rows[0] ?? null);

        if (!revision) throw notFound("Document revision not found");
        if (existing.latestRevisionId === revision.id) {
          throw conflict("Selected revision is already the latest revision", {
            currentRevisionId: existing.latestRevisionId,
          });
        }

        const now = new Date();
        const nextRevisionNumber = existing.latestRevisionNumber + 1;
        const [restoredRevision] = await tx
          .insert(documentRevisions)
          .values({
            companyId: existing.companyId,
            documentId: existing.id,
            revisionNumber: nextRevisionNumber,
            title: revision.title ?? null,
            format: revision.format,
            body: revision.body,
            changeSummary: `Restored from revision ${revision.revisionNumber}`,
            createdByAgentId: input.createdByAgentId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            createdAt: now,
          })
          .returning();

        const [updated] = await tx
          .update(documents)
          .set({
            title: revision.title ?? null,
            format: revision.format,
            latestBody: revision.body,
            latestRevisionId: restoredRevision.id,
            latestRevisionNumber: nextRevisionNumber,
            updatedByAgentId: input.createdByAgentId ?? null,
            updatedByUserId: input.createdByUserId ?? null,
            updatedAt: now,
          })
          .where(eq(documents.id, existing.id))
          .returning();

        return {
          restoredFromRevisionId: revision.id,
          restoredFromRevisionNumber: revision.revisionNumber,
          document: mapLibraryDocumentRow(updated, true),
          revision: { id: restoredRevision.id, revisionNumber: nextRevisionNumber, body: revision.body },
        };
      });
    },

    /**
     * Persist a mirror file pointer onto the document (current pointer) and optionally
     * onto a specific revision row. Idempotent metadata-only write; failure here never
     * affects the canonical body.
     */
    recordMirror: async (input: {
      documentId: string;
      revisionId?: string | null;
      pointer: DocumentMirrorPointer;
      mirroredAt?: Date;
    }) => {
      const mirroredAt = input.mirroredAt ?? new Date();
      await db
        .update(documents)
        .set({
          mirrorProvider: input.pointer.provider,
          mirrorObjectKey: input.pointer.objectKey,
          mirrorSha256: input.pointer.sha256,
          mirrorByteSize: input.pointer.byteSize,
          mirrorContentType: input.pointer.contentType,
          mirroredAt,
        })
        .where(eq(documents.id, input.documentId));
      if (input.revisionId) {
        await db
          .update(documentRevisions)
          .set({
            mirrorProvider: input.pointer.provider,
            mirrorObjectKey: input.pointer.objectKey,
            mirrorSha256: input.pointer.sha256,
            mirrorByteSize: input.pointer.byteSize,
            mirrorContentType: input.pointer.contentType,
            mirroredAt,
          })
          .where(eq(documentRevisions.id, input.revisionId));
      }
    },

    /**
     * Record a per-revision mirror pointer (used when keep_all mirrors each revision file).
     */
    recordRevisionMirror: async (input: { revisionId: string; pointer: DocumentMirrorPointer; mirroredAt?: Date }) => {
      await db
        .update(documentRevisions)
        .set({
          mirrorProvider: input.pointer.provider,
          mirrorObjectKey: input.pointer.objectKey,
          mirrorSha256: input.pointer.sha256,
          mirrorByteSize: input.pointer.byteSize,
          mirrorContentType: input.pointer.contentType,
          mirroredAt: input.mirroredAt ?? new Date(),
        })
        .where(eq(documentRevisions.id, input.revisionId));
    },

    /**
     * Set a document's retention policy. When switching to 'current_only', prunes all
     * non-latest revisions and returns their mirror keys so the caller can delete the
     * mirror files. Annotation references to pruned revisions are re-pointed/cleaned.
     */
    setRetentionPolicy: async (input: {
      companyId: string;
      documentId: string;
      policy: DocumentRetentionPolicy;
    }) => {
      return db.transaction(async (tx) => {
        const doc = await tx
          .select(libraryDocumentSelect)
          .from(documents)
          .where(and(eq(documents.companyId, input.companyId), eq(documents.id, input.documentId)))
          .then((rows) => rows[0] ?? null);
        if (!doc) throw notFound("Document not found");

        await tx
          .update(documents)
          .set({ retentionPolicy: input.policy, updatedAt: new Date() })
          .where(eq(documents.id, doc.id));

        let prunedRevisions: { id: string; revisionNumber: number; mirrorObjectKey: string | null }[] = [];
        if (input.policy === "current_only") {
          prunedRevisions = await pruneNonLatestRevisions(tx, doc);
        }

        return {
          document: mapLibraryDocumentRow({ ...doc, retentionPolicy: input.policy }, true),
          prunedRevisions,
        };
      });
    },

    /** Prune all non-latest revisions of a document (used when retentionPolicy = current_only). */
    pruneNonLatestRevisions: async (companyId: string, documentId: string) => {
      return db.transaction(async (tx) => {
        const doc = await tx
          .select(libraryDocumentSelect)
          .from(documents)
          .where(and(eq(documents.companyId, companyId), eq(documents.id, documentId)))
          .then((rows) => rows[0] ?? null);
        if (!doc) throw notFound("Document not found");
        return pruneNonLatestRevisions(tx, doc);
      });
    },

    /**
     * Hard-delete a single non-latest revision (and signal its mirror file for deletion).
     * Re-points annotation threads off the discarded revision and removes its anchor
     * snapshots so no dangling references remain. Revision numbers are not reused (gaps OK).
     */
    discardRevision: async (input: { companyId: string; documentId: string; revisionId: string }) => {
      return db.transaction(async (tx) => {
        const doc = await tx
          .select(libraryDocumentSelect)
          .from(documents)
          .where(and(eq(documents.companyId, input.companyId), eq(documents.id, input.documentId)))
          .then((rows) => rows[0] ?? null);
        if (!doc) throw notFound("Document not found");
        if (doc.lockedAt) {
          throw conflict("Document is locked", { documentId: doc.id, lockedAt: doc.lockedAt });
        }
        if (doc.latestRevisionId === input.revisionId) {
          throw conflict("Cannot discard the current revision", { currentRevisionId: doc.latestRevisionId });
        }

        const revision = await tx
          .select({
            id: documentRevisions.id,
            revisionNumber: documentRevisions.revisionNumber,
            mirrorObjectKey: documentRevisions.mirrorObjectKey,
          })
          .from(documentRevisions)
          .where(and(eq(documentRevisions.id, input.revisionId), eq(documentRevisions.documentId, doc.id)))
          .then((rows) => rows[0] ?? null);
        if (!revision) throw notFound("Document revision not found");

        await cleanupAnnotationsForRevisions(tx, doc.id, [revision.id], {
          id: doc.latestRevisionId,
          number: doc.latestRevisionNumber,
        });
        await tx.delete(documentRevisions).where(eq(documentRevisions.id, revision.id));

        return {
          discardedRevision: {
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            mirrorObjectKey: revision.mirrorObjectKey,
          },
          document: mapLibraryDocumentRow(doc, false),
        };
      });
    },
  };
}
