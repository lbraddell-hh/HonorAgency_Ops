import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response, Router } from "express";
import { Router as createRouter } from "express";
import { z } from "zod";
import { ceoWelcome, runTurn, type TurnEvent } from "../agency/engine.js";
import { env } from "../env.js";
import {
  appendMessage,
  createSession,
  getMessages,
  getProfileByEmail,
  getSession,
  getProfile,
  listAgents,
  upsertProfile,
} from "../store.js";

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

/**
 * The front-door MCP server: the same flows the web app uses, exposed over
 * Streamable HTTP so Copilot agents and other MCP hosts can engage the agency.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "honorhealth-front-door", version: "0.1.0" });

  server.tool(
    "start_session",
    "Start a chat session with the agency for an employee (identified by email). Creates the profile if needed. Returns the session id and the CEO's welcome message.",
    { email: z.string().email(), displayName: z.string().optional() },
    async ({ email, displayName }) => {
      const profile =
        (await getProfileByEmail(email)) ??
        (await upsertProfile({ email, displayName: displayName ?? email.split("@")[0] }));
      const session = await createSession(profile.id);
      const welcome = await ceoWelcome(profile);
      await appendMessage({ sessionId: session.id, role: "agent", agentSlug: "ceo", body: welcome });
      return text({ sessionId: session.id, welcome });
    },
  );

  server.tool(
    "send_message",
    "Send a message to an active agency session and get the full response, including any specialist handoffs and tasks created.",
    { sessionId: z.string(), message: z.string() },
    async ({ sessionId, message }) => {
      const session = await getSession(sessionId);
      if (!session) return text({ error: "session not found" });
      const profile = await getProfile(session.profileId);
      if (!profile) return text({ error: "profile missing for session" });

      const replies: Array<{ agent: string; text: string }> = [];
      const events: TurnEvent[] = [];
      let buffer = "";
      let bufferAgent = "";
      const flush = () => {
        if (buffer.trim()) replies.push({ agent: bufferAgent, text: buffer.trim() });
        buffer = "";
      };
      await runTurn(session, profile, message, (event) => {
        if (event.type === "chunk") {
          if (event.agentSlug !== bufferAgent) flush();
          bufferAgent = event.agentSlug;
          buffer += event.text;
        } else if (["handoff", "handback", "task_created", "error"].includes(event.type)) {
          flush();
          events.push(event);
        }
      });
      flush();
      return text({ replies, events });
    },
  );

  server.tool(
    "get_user_profile",
    "Look up what the agency knows about an employee: org-chart fields plus learned interests, priorities, and communication style.",
    { email: z.string().email() },
    async ({ email }) => {
      const profile = await getProfileByEmail(email);
      return text(profile ?? { error: "profile not found" });
    },
  );

  server.tool("list_agents", "List the agency's agent roster (the digital talent available to source).", {}, async () => {
    const agents = await listAgents();
    return text(agents.map(({ slug, displayName, role, tagline, audience }) => ({ slug, displayName, role, tagline, audience })));
  });

  server.tool(
    "get_session_transcript",
    "Fetch the full message transcript of a session, including handoff and task events.",
    { sessionId: z.string() },
    async ({ sessionId }) => {
      const messages = await getMessages(sessionId);
      return text(messages.map(({ seq, role, agentSlug, kind, body }) => ({ seq, role, agentSlug, kind, body })));
    },
  );

  return server;
}

function bearerAuth(req: Request): boolean {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const expected = Buffer.from(env.mcpApiKey);
  const provided = Buffer.from(token);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function mcpRoutes(): Router {
  const router = createRouter();

  const requireAuth: RequestHandler = (req, res, next) => {
    if (!bearerAuth(req)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: provide Authorization: Bearer <FRONT_DOOR_MCP_API_KEY>" },
        id: null,
      });
      return;
    }
    next();
  };

  // Stateless Streamable HTTP: a fresh server + transport per request.
  router.post("/mcp", requireAuth, async (req: Request, res: Response) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  const methodNotAllowed: RequestHandler = (_req, res) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless transport)" }, id: null });
  };
  router.get("/mcp", requireAuth, methodNotAllowed);
  router.delete("/mcp", requireAuth, methodNotAllowed);

  return router;
}
