import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { asc, eq } from "drizzle-orm";
import { fdAttachments } from "@paperclipai/db";
import { db } from "./db.js";

export type Attachment = typeof fdAttachments.$inferSelect;

/** Local storage root (GCP-ready: rows carry provider + objectKey, so swapping
 *  in a bucket later only changes this module). */
export const UPLOADS_DIR = fileURLToPath(new URL("../uploads/", import.meta.url));
mkdirSync(UPLOADS_DIR, { recursive: true });

export function attachmentAbsolutePath(attachment: Pick<Attachment, "objectKey">): string {
  return join(UPLOADS_DIR, attachment.objectKey);
}

export async function createAttachment(input: {
  sessionId: string;
  profileId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  objectKey: string;
}): Promise<Attachment> {
  const [created] = await db.insert(fdAttachments).values(input).returning();
  return created;
}

export async function getAttachment(id: string): Promise<Attachment | undefined> {
  return db.query.fdAttachments.findFirst({ where: eq(fdAttachments.id, id) });
}

/** attachmentId -> absolute path, for injecting file context into agent turns. */
export async function getAttachmentPathsForSession(sessionId: string): Promise<Map<string, string>> {
  const rows = await db.query.fdAttachments.findMany({
    where: eq(fdAttachments.sessionId, sessionId),
    orderBy: [asc(fdAttachments.createdAt)],
  });
  return new Map(rows.map((a) => [a.id, attachmentAbsolutePath(a)]));
}
