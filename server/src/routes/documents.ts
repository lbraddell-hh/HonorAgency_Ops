import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  documentSlugSchema,
  upsertLibraryDocumentSchema,
  setDocumentRetentionPolicySchema,
  restoreDocumentRevisionSchema,
} from "@paperclipai/shared";
import { documentService, logActivity, type DocumentMirrorPointer } from "../services/index.js";
import { mirrorCurrent, mirrorRevision, deleteMirror, type DocumentMirrorTarget } from "../storage/document-mirror.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

type LibraryDocument = Awaited<ReturnType<ReturnType<typeof documentService>["getLibraryDocument"]>>;

/** Storage location for a library document's mirror files: documents/library/{path?}/{slug}. */
function libraryMirrorTarget(companyId: string, doc: { slug: string | null; id: string; path: string | null }): DocumentMirrorTarget {
  const identifier = [doc.path, doc.slug ?? doc.id].filter(Boolean).join("/");
  return { companyId, scope: "library", identifier };
}

export function documentRoutes(db: Db) {
  const router = Router();
  const svc = documentService(db);

  const pointerOf = (
    result: { provider: string; objectKey: string; sha256: string; byteSize: number; contentType: string } | null,
  ): DocumentMirrorPointer | null =>
    result
      ? {
          provider: result.provider,
          objectKey: result.objectKey,
          sha256: result.sha256,
          byteSize: result.byteSize,
          contentType: result.contentType,
        }
      : null;

  // Mirror current (+ revision when keep_all) and persist pointers. Best-effort, post-commit.
  async function mirrorAndRecord(
    companyId: string,
    doc: NonNullable<LibraryDocument>,
    revision: { id: string; revisionNumber: number; body: string },
  ) {
    const target = libraryMirrorTarget(companyId, doc);
    const currentPointer = pointerOf(await mirrorCurrent(target, revision.body));
    if (currentPointer) {
      await svc.recordMirror({
        documentId: doc.id,
        revisionId: doc.retentionPolicy === "keep_all" ? null : revision.id,
        pointer: currentPointer,
      });
    }
    if (doc.retentionPolicy === "keep_all") {
      const revPointer = pointerOf(await mirrorRevision(target, revision.revisionNumber, revision.body));
      if (revPointer) {
        await svc.recordRevisionMirror({ revisionId: revision.id, pointer: revPointer });
        // Also stamp the document's current pointer to the (identical) current.md write above.
        if (!currentPointer) {
          await svc.recordMirror({ documentId: doc.id, pointer: revPointer });
        }
      }
    } else {
      // current_only: prune older revisions + their mirror files.
      const pruned = await svc.pruneNonLatestRevisions(companyId, doc.id);
      for (const rev of pruned) {
        await deleteMirror(companyId, rev.mirrorObjectKey);
      }
    }
  }

  // List library documents for a company (optionally filtered by folder path).
  router.get("/companies/:companyId/documents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const path = typeof req.query.path === "string" && req.query.path.length > 0 ? req.query.path : null;
    const docs = await svc.listLibraryDocuments(companyId, { path });
    res.json({ documents: docs });
  });

  // Get a single library document (with body).
  router.get("/companies/:companyId/documents/:slug", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
    if (!slugParsed.success) {
      res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
      return;
    }
    const doc = await svc.getLibraryDocument(companyId, slugParsed.data);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({ document: doc });
  });

  // Create or update a library document (upsert by slug, optimistic concurrency via baseRevisionId).
  router.put(
    "/companies/:companyId/documents/:slug",
    validate(upsertLibraryDocumentSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
      if (!slugParsed.success) {
        res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
        return;
      }
      if (req.body.slug && req.body.slug !== slugParsed.data) {
        res.status(400).json({ error: "Body slug does not match URL slug" });
        return;
      }
      const actor = getActorInfo(req);
      const result = await svc.upsertLibraryDocument({
        companyId,
        slug: slugParsed.data,
        path: req.body.path ?? null,
        title: req.body.title ?? null,
        format: req.body.format,
        body: req.body.body,
        changeSummary: req.body.changeSummary ?? null,
        baseRevisionId: req.body.baseRevisionId ?? null,
        retentionPolicy: req.body.retentionPolicy,
        createdByAgentId: actor.agentId ?? null,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
        createdByRunId: actor.runId ?? null,
      });

      await mirrorAndRecord(companyId, result.document, result.revision);
      const fresh = await svc.getLibraryDocument(companyId, slugParsed.data);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: result.created ? "document_created" : "document_updated",
        entityType: "document",
        entityId: result.document.id,
        details: {
          documentId: result.document.id,
          scope: "library",
          slug: slugParsed.data,
          revisionNumber: result.revision.revisionNumber,
          mirrorProvider: fresh?.mirrorProvider ?? null,
          mirrorObjectKey: fresh?.mirrorObjectKey ?? null,
          mirrorSha256: fresh?.mirrorSha256 ?? null,
          mirrorByteSize: fresh?.mirrorByteSize ?? null,
          mirrorStatus: fresh?.mirroredAt ? "ok" : "failed",
        },
      });

      res.status(result.created ? 201 : 200).json({ document: fresh ?? result.document, created: result.created });
    },
  );

  // List revisions for a library document.
  router.get("/companies/:companyId/documents/:slug/revisions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
    if (!slugParsed.success) {
      res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
      return;
    }
    const revisions = await svc.listLibraryDocumentRevisions(companyId, slugParsed.data);
    res.json({ revisions });
  });

  // Restore an older revision (appends a new revision; non-destructive).
  router.post(
    "/companies/:companyId/documents/:slug/revisions/:revisionId/restore",
    validate(restoreDocumentRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
      if (!slugParsed.success) {
        res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
        return;
      }
      const actor = getActorInfo(req);
      const result = await svc.restoreLibraryDocumentRevision({
        companyId,
        slug: slugParsed.data,
        revisionId: req.params.revisionId as string,
        createdByAgentId: actor.agentId ?? null,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      await mirrorAndRecord(companyId, result.document, result.revision);
      const fresh = await svc.getLibraryDocument(companyId, slugParsed.data);

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "document_updated",
        entityType: "document",
        entityId: result.document.id,
        details: {
          documentId: result.document.id,
          scope: "library",
          slug: slugParsed.data,
          revisionNumber: result.revision.revisionNumber,
          restoredFromRevisionNumber: result.restoredFromRevisionNumber,
          mirrorObjectKey: fresh?.mirrorObjectKey ?? null,
          mirrorSha256: fresh?.mirrorSha256 ?? null,
        },
      });

      res.json({
        document: fresh ?? result.document,
        restoredFromRevisionNumber: result.restoredFromRevisionNumber,
      });
    },
  );

  // Set retention policy (keep_all | current_only). current_only prunes old revisions + files.
  router.post(
    "/companies/:companyId/documents/:slug/retention",
    validate(setDocumentRetentionPolicySchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
      if (!slugParsed.success) {
        res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
        return;
      }
      const doc = await svc.getLibraryDocument(companyId, slugParsed.data);
      if (!doc) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
      const actor = getActorInfo(req);
      const result = await svc.setRetentionPolicy({
        companyId,
        documentId: doc.id,
        policy: req.body.policy,
      });
      for (const rev of result.prunedRevisions) {
        await deleteMirror(companyId, rev.mirrorObjectKey);
      }

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "document_updated",
        entityType: "document",
        entityId: doc.id,
        details: {
          documentId: doc.id,
          scope: "library",
          slug: slugParsed.data,
          retentionPolicy: req.body.policy,
          prunedRevisionCount: result.prunedRevisions.length,
        },
      });

      res.json({ document: result.document, prunedRevisionCount: result.prunedRevisions.length });
    },
  );

  // Discard (hard-delete) a single non-latest revision + its mirror file.
  router.delete("/companies/:companyId/documents/:slug/revisions/:revisionId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
    if (!slugParsed.success) {
      res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
      return;
    }
    const doc = await svc.getLibraryDocument(companyId, slugParsed.data);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const actor = getActorInfo(req);
    const result = await svc.discardRevision({
      companyId,
      documentId: doc.id,
      revisionId: req.params.revisionId as string,
    });
    await deleteMirror(companyId, result.discardedRevision.mirrorObjectKey);

    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "document_revision_discarded",
      entityType: "document",
      entityId: doc.id,
      details: {
        documentId: doc.id,
        scope: "library",
        slug: slugParsed.data,
        discardedRevisionNumber: result.discardedRevision.revisionNumber,
      },
    });

    res.json({ discardedRevisionNumber: result.discardedRevision.revisionNumber });
  });

  // Stream the mirrored current.md (or a specific revision file) for download / raw view.
  router.get("/companies/:companyId/documents/:slug/file", async (req, res, next) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const slugParsed = documentSlugSchema.safeParse(String(req.params.slug ?? "").trim().toLowerCase());
    if (!slugParsed.success) {
      res.status(400).json({ error: "Invalid document slug", details: slugParsed.error.issues });
      return;
    }
    const doc = await svc.getLibraryDocument(companyId, slugParsed.data);
    if (!doc || !doc.mirrorObjectKey) {
      res.status(404).json({ error: "Document file not available" });
      return;
    }
    await streamDocumentFile(req, res, next, companyId, doc.mirrorObjectKey, `${slugParsed.data}.md`);
  });

  return router;
}

// Lazy import of the storage singleton to keep route construction side-effect free.
async function streamDocumentFile(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
  companyId: string,
  objectKey: string,
  downloadFilename: string,
) {
  const { getStorageService } = await import("../storage/index.js");
  const storage = getStorageService();
  const object = await storage.getObject(companyId, objectKey);
  res.setHeader("Content-Type", object.contentType || "text/markdown; charset=utf-8");
  if (object.contentLength != null) res.setHeader("Content-Length", String(object.contentLength));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=30");
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${downloadFilename.replaceAll("\"", "")}"`);
  object.stream.on("error", (err) => next(err));
  object.stream.pipe(res);
}
