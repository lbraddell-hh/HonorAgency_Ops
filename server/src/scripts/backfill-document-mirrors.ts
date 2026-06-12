import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { companies, createDb, documents, documentRevisions, issueDocuments } from "@paperclipai/db";
import { loadConfig } from "../config.js";
import { documentService } from "../services/documents.js";
import { mirrorCurrent, mirrorRevision, type DocumentMirrorTarget } from "../storage/document-mirror.js";

function parseFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function sha256(input: string): string {
  return createHash("sha256").update(Buffer.from(input, "utf8")).digest("hex");
}

async function main() {
  const config = loadConfig();
  const dbUrl =
    process.env.DATABASE_URL?.trim() ||
    config.databaseUrl ||
    `postgres://paperclip:paperclip@127.0.0.1:${config.embeddedPostgresPort}/paperclip`;

  const db = createDb(dbUrl);
  const svc = documentService(db);
  const companyId = parseFlag("--company");

  const companyRows = companyId
    ? [{ id: companyId }]
    : await db.select({ id: companies.id }).from(companies);
  if (companyRows.length === 0) {
    console.log("No companies found; nothing to backfill.");
    return;
  }

  let mirrored = 0;
  let skipped = 0;
  let failed = 0;

  for (const company of companyRows) {
    const docRows = await db
      .select({
        id: documents.id,
        companyId: documents.companyId,
        scope: documents.scope,
        slug: documents.slug,
        path: documents.path,
        latestBody: documents.latestBody,
        retentionPolicy: documents.retentionPolicy,
        mirrorSha256: documents.mirrorSha256,
      })
      .from(documents)
      .where(eq(documents.companyId, company.id));

    for (const doc of docRows) {
      // Idempotent: skip if the current body is already mirrored.
      if (doc.mirrorSha256 && doc.mirrorSha256 === sha256(doc.latestBody)) {
        skipped += 1;
        continue;
      }

      // Resolve a stable, human-readable identifier for the mirror key.
      let identifier: string;
      if (doc.scope === "library") {
        identifier = [doc.path, doc.slug ?? doc.id].filter(Boolean).join("/");
      } else {
        const link = await db
          .select({ issueId: issueDocuments.issueId, key: issueDocuments.key })
          .from(issueDocuments)
          .where(eq(issueDocuments.documentId, doc.id))
          .then((rows) => rows[0] ?? null);
        identifier = link ? `${link.issueId}/${link.key}` : `orphan/${doc.id}`;
      }
      const target: DocumentMirrorTarget = {
        companyId: doc.companyId,
        scope: doc.scope === "library" ? "library" : "issue",
        identifier,
      };

      const current = await mirrorCurrent(target, doc.latestBody);
      if (!current) {
        failed += 1;
        console.warn(`  ! failed to mirror current for document ${doc.id}`);
        continue;
      }
      await svc.recordMirror({ documentId: doc.id, pointer: current });
      mirrored += 1;

      // keep_all → also mirror each revision file.
      if (doc.retentionPolicy === "keep_all") {
        const revs = await db
          .select({
            id: documentRevisions.id,
            revisionNumber: documentRevisions.revisionNumber,
            body: documentRevisions.body,
            mirrorSha256: documentRevisions.mirrorSha256,
          })
          .from(documentRevisions)
          .where(eq(documentRevisions.documentId, doc.id));
        for (const rev of revs) {
          if (rev.mirrorSha256 && rev.mirrorSha256 === sha256(rev.body)) continue;
          const revPointer = await mirrorRevision(target, rev.revisionNumber, rev.body);
          if (revPointer) await svc.recordRevisionMirror({ revisionId: rev.id, pointer: revPointer });
        }
      }
    }
  }

  console.log(`Document mirror backfill complete: ${mirrored} mirrored, ${skipped} already current, ${failed} failed.`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Document mirror backfill failed: ${message}`);
  process.exit(1);
});
