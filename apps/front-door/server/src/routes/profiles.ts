import { Router } from "express";
import {
  deleteLearnedNote,
  editLearnedItem,
  getProfile,
  getProfileByEmail,
  listSessionsForProfile,
  updateProfileFields,
  upsertProfile,
} from "../store.js";

const LEARNED_FIELDS = ["interests", "priorities", "notes", "communicationStyle"] as const;

export function profileRoutes(): Router {
  const router = Router();

  // Intake: create or refresh an employee profile (the CEO's welcome desk).
  router.post("/api/profiles", async (req, res) => {
    const { email, displayName, title, department, reportsToName } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@") || typeof displayName !== "string" || !displayName.trim()) {
      res.status(400).json({ error: "email and displayName are required" });
      return;
    }
    const profile = await upsertProfile({ email, displayName: displayName.trim(), title, department, reportsToName });
    res.json(profile);
  });

  router.get("/api/profiles/by-email/:email", async (req, res) => {
    const profile = await getProfileByEmail(req.params.email);
    if (!profile) {
      res.status(404).json({ error: "profile not found" });
      return;
    }
    res.json(profile);
  });

  router.get("/api/profiles/:id", async (req, res) => {
    const profile = await getProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ error: "profile not found" });
      return;
    }
    res.json(profile);
  });

  router.get("/api/profiles/:id/sessions", async (req, res) => {
    res.json(await listSessionsForProfile(req.params.id));
  });

  // User-editable org fields ("tell the agency who you are").
  router.patch("/api/profiles/:id", async (req, res) => {
    const { displayName, title, department, reportsToName } = req.body ?? {};
    const updated = await updateProfileFields(req.params.id, { displayName, title, department, reportsToName });
    if (!updated) {
      res.status(404).json({ error: "profile not found" });
      return;
    }
    res.json(updated);
  });

  // "Everything the agency knows about me is visible and forgettable."
  router.delete("/api/profiles/:id/learned", async (req, res) => {
    const { field, value } = req.body ?? {};
    if (!LEARNED_FIELDS.includes(field)) {
      res.status(400).json({ error: "field must be interests | priorities | notes | communicationStyle" });
      return;
    }
    const updated = await deleteLearnedNote(req.params.id, field, String(value ?? ""));
    if (!updated) {
      res.status(404).json({ error: "profile not found" });
      return;
    }
    res.json(updated);
  });

  // ...and correctable: edit a learned pill in place.
  router.put("/api/profiles/:id/learned", async (req, res) => {
    const { field, value, newValue } = req.body ?? {};
    if (!LEARNED_FIELDS.includes(field) || typeof newValue !== "string" || !newValue.trim()) {
      res.status(400).json({ error: "field and a non-empty newValue are required" });
      return;
    }
    const updated = await editLearnedItem(req.params.id, field, String(value ?? ""), newValue);
    if (!updated) {
      res.status(404).json({ error: "profile not found" });
      return;
    }
    res.json(updated);
  });

  return router;
}
