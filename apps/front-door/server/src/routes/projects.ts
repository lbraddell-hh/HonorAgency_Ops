import { Router } from "express";
import { addProjectMember, getProjectDetail, listProjectsForProfile } from "../projects-store.js";

export function projectRoutes(): Router {
  const router = Router();

  // Every job req the employee owns or has been added to.
  router.get("/api/profiles/:id/projects", async (req, res) => {
    res.json(await listProjectsForProfile(req.params.id));
  });

  router.get("/api/projects/:id", async (req, res) => {
    const detail = await getProjectDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: "job req not found" });
      return;
    }
    res.json(detail);
  });

  // Share a job req with another employee by email.
  router.post("/api/projects/:id/members", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email.includes("@")) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const result = await addProjectMember(req.params.id, email);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    const detail = await getProjectDetail(req.params.id);
    res.json(detail);
  });

  return router;
}
