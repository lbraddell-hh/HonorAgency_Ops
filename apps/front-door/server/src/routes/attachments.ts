import { Router } from "express";
import { extname } from "node:path";
import multer from "multer";
import {
  attachmentAbsolutePath,
  createAttachment,
  getAttachment,
  UPLOADS_DIR,
} from "../attachments-store.js";
import { appendMessage, getSession } from "../store.js";

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export function attachmentRoutes(): Router {
  const router = Router();

  // Share a file/image into a session. The upload becomes part of the
  // transcript (kind "file"), so agents see it on the next turn.
  router.post("/api/sessions/:id/attachments", upload.single("file"), async (req, res) => {
    const session = await getSession(String(req.params.id));
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "multipart field 'file' is required" });
      return;
    }
    // Multer decodes originalname as latin1; restore utf8 for names with accents.
    const filename = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const attachment = await createAttachment({
      sessionId: session.id,
      profileId: session.profileId,
      filename,
      mimeType: req.file.mimetype || "application/octet-stream",
      byteSize: req.file.size,
      objectKey: req.file.filename,
    });
    const message = await appendMessage({
      sessionId: session.id,
      role: "user",
      kind: "file",
      body: filename,
      meta: { attachmentId: attachment.id, mimeType: attachment.mimeType },
    });
    res.json({ attachment, message });
  });

  router.get("/api/attachments/:id", async (req, res) => {
    const attachment = await getAttachment(req.params.id);
    if (!attachment) {
      res.status(404).json({ error: "attachment not found" });
      return;
    }
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.filename)}"`);
    res.sendFile(attachmentAbsolutePath(attachment));
  });

  return router;
}
