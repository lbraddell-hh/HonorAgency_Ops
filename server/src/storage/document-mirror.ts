import type { DocumentScope } from "@paperclipai/shared";
import { getStorageService, type StorageService } from "./index.js";
import { sanitizeSegment } from "./service.js";
import type { PutObjectAtKeyResult } from "./types.js";
import { logger } from "../middleware/logger.js";

const MIRROR_CONTENT_TYPE = "text/markdown";

/**
 * Identifies the storage location for a document's mirror files. `identifier` may
 * contain "/" to express folder structure:
 *  - library documents: the path + slug (or the document id as a fallback)
 *  - issue documents:    "{issueId}/{key}"
 */
export interface DocumentMirrorTarget {
  companyId: string;
  scope: DocumentScope;
  identifier: string;
}

function sanitizeIdentifier(identifier: string): string {
  const segments = identifier
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizeSegment(segment));
  return segments.length > 0 ? segments.join("/") : "untitled";
}

function baseKey(target: DocumentMirrorTarget): string {
  return `${target.companyId}/documents/${target.scope}/${sanitizeIdentifier(target.identifier)}`;
}

export function documentCurrentKey(target: DocumentMirrorTarget): string {
  return `${baseKey(target)}/current.md`;
}

export function documentRevisionKey(target: DocumentMirrorTarget, revisionNumber: number): string {
  return `${baseKey(target)}/revisions/${revisionNumber}.md`;
}

/**
 * Mirror the current document body to a stable `current.md` file. Best-effort: a
 * failure logs and returns null (the canonical DB write has already committed).
 */
export async function mirrorCurrent(
  target: DocumentMirrorTarget,
  body: string,
  storage: StorageService = getStorageService(),
): Promise<PutObjectAtKeyResult | null> {
  const objectKey = documentCurrentKey(target);
  try {
    return await storage.putObjectAtKey(target.companyId, objectKey, Buffer.from(body, "utf8"), MIRROR_CONTENT_TYPE);
  } catch (err) {
    logger.warn({ err, objectKey, companyId: target.companyId }, "document mirror (current) failed");
    return null;
  }
}

/**
 * Mirror a specific revision body to `revisions/{n}.md`. Best-effort (see mirrorCurrent).
 */
export async function mirrorRevision(
  target: DocumentMirrorTarget,
  revisionNumber: number,
  body: string,
  storage: StorageService = getStorageService(),
): Promise<PutObjectAtKeyResult | null> {
  const objectKey = documentRevisionKey(target, revisionNumber);
  try {
    return await storage.putObjectAtKey(target.companyId, objectKey, Buffer.from(body, "utf8"), MIRROR_CONTENT_TYPE);
  } catch (err) {
    logger.warn({ err, objectKey, companyId: target.companyId }, "document mirror (revision) failed");
    return null;
  }
}

/**
 * Idempotently delete a mirror file. Best-effort; missing files are not an error.
 */
export async function deleteMirror(
  companyId: string,
  objectKey: string | null | undefined,
  storage: StorageService = getStorageService(),
): Promise<void> {
  if (!objectKey) return;
  try {
    await storage.deleteObject(companyId, objectKey);
  } catch (err) {
    logger.warn({ err, objectKey, companyId }, "document mirror delete failed");
  }
}
