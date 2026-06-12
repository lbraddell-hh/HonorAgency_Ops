import { Router } from "express";
import { ceoWelcome, runTurn, type TurnEvent } from "../agency/engine.js";
import { learnFromSession } from "../agency/learning.js";
import {
  appendMessage,
  createSession,
  getMessages,
  getProfile,
  getSession,
  listAgents,
} from "../store.js";

export function sessionRoutes(): Router {
  const router = Router();

  router.get("/api/agents", async (_req, res) => {
    res.json(await listAgents());
  });

  // Start a session. The CEO is the only reachable agent — every session opens
  // with the CEO's welcome; specialists arrive solely via handoff.
  router.post("/api/sessions", async (req, res) => {
    const { profileId } = req.body ?? {};
    const profile = profileId ? await getProfile(profileId) : undefined;
    if (!profile) {
      res.status(400).json({ error: "profileId is required and must exist" });
      return;
    }
    const session = await createSession(profile.id, "ceo");
    const welcome = await ceoWelcome(profile);
    await appendMessage({ sessionId: session.id, role: "agent", agentSlug: "ceo", body: welcome });
    res.json({ session, messages: await getMessages(session.id) });
  });

  router.get("/api/sessions/:id", async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    res.json(session);
  });

  router.get("/api/sessions/:id/messages", async (req, res) => {
    res.json(await getMessages(req.params.id));
  });

  // Send a message; response streams back as SSE.
  router.post("/api/sessions/:id/messages", async (req, res) => {
    const session = await getSession(req.params.id);
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const profile = await getProfile(session.profileId);
    if (!profile) {
      res.status(500).json({ error: "profile missing for session" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const send = (event: TurnEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

    try {
      await runTurn(session, profile, text, send);
    } catch (error) {
      console.error("turn failed:", error);
      send({ type: "error", message: error instanceof Error ? error.message : "turn failed" });
    }
    res.end();
  });

  // Close the session and run the learning loop.
  router.post("/api/sessions/:id/close", async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    if (session.status !== "active") {
      res.json({ session, alreadyClosed: true });
      return;
    }
    try {
      const { summary } = await learnFromSession(session);
      const profile = await getProfile(session.profileId);
      res.json({ summary, profile });
    } catch (error) {
      console.error("learning loop failed:", error);
      res.status(500).json({ error: "learning loop failed" });
    }
  });

  return router;
}
