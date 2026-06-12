import express from "express";
import { env } from "./env.js";
import { mcpRoutes } from "./mcp/server.js";
import { attachmentRoutes } from "./routes/attachments.js";
import { profileRoutes } from "./routes/profiles.js";
import { projectRoutes } from "./routes/projects.js";
import { sessionRoutes } from "./routes/sessions.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "honorhealth-front-door" });
});

app.use(profileRoutes());
app.use(sessionRoutes());
app.use(attachmentRoutes());
app.use(projectRoutes());
app.use(mcpRoutes());

app.listen(env.port, () => {
  console.log(`HonorHealth Front Door server on http://localhost:${env.port}`);
  console.log(`  REST: /api/*   MCP (Streamable HTTP): /mcp`);
});
