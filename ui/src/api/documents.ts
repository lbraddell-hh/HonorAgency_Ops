import { api } from "./client";

export type DocumentRetentionPolicy = "keep_all" | "current_only";

export interface LibraryDocument {
  id: string;
  companyId: string;
  scope: string;
  slug: string | null;
  path: string | null;
  retentionPolicy: DocumentRetentionPolicy;
  title: string | null;
  format: string;
  body?: string;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  mirrorProvider: string | null;
  mirrorObjectKey: string | null;
  mirrorSha256: string | null;
  mirrorByteSize: number | null;
  mirrorContentType: string | null;
  mirroredAt: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryDocumentRevision {
  id: string;
  companyId: string;
  documentId: string;
  revisionNumber: number;
  title: string | null;
  format: string;
  body: string;
  changeSummary: string | null;
  mirrorProvider: string | null;
  mirrorObjectKey: string | null;
  mirrorSha256: string | null;
  mirroredAt: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface UpsertLibraryDocumentInput {
  path?: string | null;
  title?: string | null;
  format?: "markdown";
  body: string;
  changeSummary?: string | null;
  baseRevisionId?: string | null;
  retentionPolicy?: DocumentRetentionPolicy;
}

export const documentsApi = {
  list: (companyId: string, path?: string | null) =>
    api
      .get<{ documents: LibraryDocument[] }>(
        `/companies/${companyId}/documents${path ? `?path=${encodeURIComponent(path)}` : ""}`,
      )
      .then((r) => r.documents),
  get: (companyId: string, slug: string) =>
    api
      .get<{ document: LibraryDocument }>(`/companies/${companyId}/documents/${encodeURIComponent(slug)}`)
      .then((r) => r.document),
  upsert: (companyId: string, slug: string, data: UpsertLibraryDocumentInput) =>
    api.put<{ document: LibraryDocument; created: boolean }>(
      `/companies/${companyId}/documents/${encodeURIComponent(slug)}`,
      { format: "markdown", ...data, slug },
    ),
  listRevisions: (companyId: string, slug: string) =>
    api
      .get<{ revisions: LibraryDocumentRevision[] }>(
        `/companies/${companyId}/documents/${encodeURIComponent(slug)}/revisions`,
      )
      .then((r) => r.revisions),
  restoreRevision: (companyId: string, slug: string, revisionId: string) =>
    api.post<{ document: LibraryDocument; restoredFromRevisionNumber: number }>(
      `/companies/${companyId}/documents/${encodeURIComponent(slug)}/revisions/${revisionId}/restore`,
      {},
    ),
  setRetention: (companyId: string, slug: string, policy: DocumentRetentionPolicy) =>
    api.post<{ document: LibraryDocument; prunedRevisionCount: number }>(
      `/companies/${companyId}/documents/${encodeURIComponent(slug)}/retention`,
      { policy },
    ),
  discardRevision: (companyId: string, slug: string, revisionId: string) =>
    api.delete<{ discardedRevisionNumber: number }>(
      `/companies/${companyId}/documents/${encodeURIComponent(slug)}/revisions/${revisionId}`,
    ),
  fileUrl: (companyId: string, slug: string, opts?: { download?: boolean }) =>
    `/api/companies/${companyId}/documents/${encodeURIComponent(slug)}/file${opts?.download ? "?download=1" : ""}`,
};
