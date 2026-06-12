import Anthropic from "@anthropic-ai/sdk";
import {
  appendMessage,
  getAgentBySlug,
  getMessages,
  listAgents,
  setActiveAgent,
  type EmployeeProfile,
  type Session,
} from "../store.js";
import { openProjectsForProfile } from "../projects-store.js";
import { ceoWelcomeCli, runTurnCli } from "./engine-cli.js";
import { doCreateJobReq, doLinkJobReq, doResourceJobReq, doScopeJobReq } from "./project-tools.js";
import {
  buildSystemPrompt,
  createPaperclipTask,
  renderProfileBlock,
  type TurnEvent,
} from "./shared.js";

export type { TurnEvent } from "./shared.js";

const MODEL = "claude-opus-4-8";

/**
 * Backend selection: direct Anthropic API when a key is configured, otherwise
 * the Claude Agent SDK (local `claude` CLI subscription login) — this machine
 * runs model providers via subscription login, so the CLI path is the default.
 */
const useDirectApi = Boolean(process.env.ANTHROPIC_API_KEY);

const TOOLS: Anthropic.Tool[] = [
  {
    name: "handoff_to_specialist",
    description:
      "Bring a specialist agent into the conversation. Use when the request needs specialist depth " +
      "(data analysis, operations coordination, communications). After this call you will continue " +
      "the conversation AS the specialist. Hand back to the CEO when the specialist work is done.",
    input_schema: {
      type: "object",
      properties: {
        agent_slug: { type: "string", description: "Slug of the specialist to bring in (e.g. analyst, coordinator, comms)" },
        reason: { type: "string", description: "One sentence, user-visible: why this specialist is the right fit" },
        briefing: { type: "string", description: "Internal briefing for the specialist: what the user needs and relevant context" },
      },
      required: ["agent_slug", "reason", "briefing"],
    },
  },
  {
    name: "hand_back_to_ceo",
    description:
      "Return the conversation to the CEO when the specialist's work is complete. " +
      "Include a short summary of what was accomplished.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One or two sentences summarizing what the specialist delivered" },
      },
      required: ["summary"],
    },
  },
  {
    name: "offer_choices",
    description:
      "Present 2-4 short tappable answer options after you ask the user a question. The user can " +
      "always type a custom reply instead, so never include an 'Other' option.",
    input_schema: {
      type: "object",
      properties: {
        options: {
          type: "array",
          items: { type: "string" },
          description: "Short option labels (1-6 words each), 2-4 of them",
        },
      },
      required: ["options"],
    },
  },
  {
    name: "create_task",
    description:
      "Delegate ongoing work to the agency as a tracked task. Use when the user asks for work that " +
      "will continue beyond this conversation (a recurring deliverable, a project, research that takes time).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title" },
        description: { type: "string", description: "What needs to be done, for whom, and any deadline" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "create_job_req",
    description:
      "Create a job req — the unit of work the agency takes on. Call this as soon as the reason the " +
      "employee is contacting the agency is clear. Status starts at draft; scope it next.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Crisp job req title (3-8 words)" },
        objective: { type: "string", description: "One-sentence objective: what outcome the employee needs" },
      },
      required: ["title", "objective"],
    },
  },
  {
    name: "scope_job_req",
    description: "Lock the scope of a job req once deliverables, timeline, and success criteria are clear.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        deliverables: { type: "array", items: { type: "string" } },
        timeline: { type: "string" },
        success_criteria: { type: "array", items: { type: "string" } },
        constraints: { type: "string" },
        notes: { type: "string" },
      },
      required: ["project_id", "deliverables", "timeline", "success_criteria"],
    },
  },
  {
    name: "resource_job_req",
    description:
      "Resource a scoped job req: assign roster specialists to responsibilities. Each assignment becomes a tracked task.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        plan: {
          type: "array",
          items: {
            type: "object",
            properties: { agent_slug: { type: "string" }, responsibility: { type: "string" } },
            required: ["agent_slug", "responsibility"],
          },
        },
      },
      required: ["project_id", "plan"],
    },
  },
  {
    name: "link_job_req",
    description:
      "Associate this session with an existing open job req when the conversation touches it. " +
      "A session may be linked to several job reqs.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["project_id"],
    },
  },
];

function buildApiHistory(messages: Awaited<ReturnType<typeof getMessages>>): Anthropic.MessageParam[] {
  const history: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      history.push({ role: "user", content: m.body });
    } else if (m.role === "agent") {
      history.push({ role: "assistant", content: `[${m.agentSlug}] ${m.body}` });
    } else if (m.kind === "handoff") {
      history.push({
        role: "assistant",
        content: `[event] Handoff: ${m.meta.fromAgent} brought in ${m.meta.toAgent}. Reason: ${m.meta.reason ?? ""}`,
      });
    } else if (m.kind === "handback") {
      history.push({
        role: "assistant",
        content: `[event] Hand-back to CEO. Summary: ${m.meta.reason ?? m.body}`,
      });
    } else if (m.kind === "file") {
      history.push({ role: "user", content: `[Shared a file: ${m.body} (${m.meta.mimeType ?? "unknown type"})]` });
    } else if (m.kind === "project") {
      history.push({
        role: "assistant",
        content: `[event] Job req ${m.meta.projectAction}: "${m.meta.projectTitle}" (id ${m.meta.projectId}). ${m.body}`,
      });
    }
  }
  return history;
}

async function runTurnApi(
  session: Session,
  profile: EmployeeProfile,
  userText: string,
  onEvent: (event: TurnEvent) => void,
): Promise<void> {
  const anthropic = new Anthropic();
  const roster = await listAgents();
  const bySlug = new Map(roster.map((a) => [a.slug, a]));
  let active = bySlug.get(session.activeAgentSlug) ?? bySlug.get("ceo");
  if (!active) throw new Error("Agent roster is empty — run the seed script (pnpm fd:seed)");

  await appendMessage({ sessionId: session.id, role: "user", body: userText });
  onEvent({ type: "start", sessionId: session.id, agentSlug: active.slug });

  const [persisted, openProjects] = await Promise.all([
    getMessages(session.id),
    openProjectsForProfile(profile.id),
  ]);
  const messages = buildApiHistory(persisted);

  for (let iteration = 0; iteration < 12; iteration++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: buildSystemPrompt(active, roster, profile, openProjects),
      tools: TOOLS,
      messages,
    });

    const speaking = active.slug;
    let text = "";
    stream.on("text", (delta) => {
      text += delta;
      onEvent({ type: "chunk", text: delta, agentSlug: speaking });
    });

    const message = await stream.finalMessage();

    if (text.trim()) {
      await appendMessage({
        sessionId: session.id,
        role: "agent",
        agentSlug: speaking,
        body: text.trim(),
      });
    }

    if (message.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of message.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, string>;
      let result = "";

      if (block.name === "handoff_to_specialist") {
        const target = bySlug.get(input.agent_slug);
        if (!target || target.slug === active.slug) {
          result = `Cannot hand off to "${input.agent_slug}". Available specialists: ${roster
            .filter((a) => a.slug !== active!.slug)
            .map((a) => a.slug)
            .join(", ")}`;
        } else {
          await appendMessage({
            sessionId: session.id,
            role: "event",
            kind: "handoff",
            agentSlug: target.slug,
            body: input.reason,
            meta: { fromAgent: active.slug, toAgent: target.slug, reason: input.reason, briefing: input.briefing },
          });
          await setActiveAgent(session.id, target.slug);
          onEvent({
            type: "handoff",
            from: active.slug,
            to: target.slug,
            toName: target.displayName,
            toRole: target.role,
            reason: input.reason,
          });
          active = target;
          result =
            `Handoff complete. You are now ${target.displayName}, ${target.role}. ` +
            `Briefing: ${input.briefing} Greet the employee briefly in your own voice and get to work.`;
        }
      } else if (block.name === "hand_back_to_ceo") {
        const ceo = bySlug.get("ceo")!;
        await appendMessage({
          sessionId: session.id,
          role: "event",
          kind: "handback",
          agentSlug: ceo.slug,
          body: input.summary,
          meta: { fromAgent: active.slug, toAgent: ceo.slug, reason: input.summary },
        });
        await setActiveAgent(session.id, ceo.slug);
        onEvent({ type: "handback", from: active.slug, to: ceo.slug, summary: input.summary });
        active = ceo;
        result = `You are now ${ceo.displayName} (CEO) again. The specialist reported: ${input.summary} Wrap up with the employee and offer the next step.`;
      } else if (block.name === "offer_choices") {
        const raw = (block.input as { options?: unknown }).options;
        const options = (Array.isArray(raw) ? raw : [])
          .map((o) => String(o).trim())
          .filter(Boolean)
          .slice(0, 4);
        await appendMessage({
          sessionId: session.id,
          role: "event",
          kind: "choices",
          agentSlug: active.slug,
          body: options.join(" | "),
          meta: { options },
        });
        onEvent({ type: "choices", options });
        result = "Options are now showing as buttons. End your turn — do not list them again in text.";
      } else if (block.name === "create_task") {
        onEvent({ type: "status", text: "Delegating task to the agency…" });
        const { issueId, delegated } = await createPaperclipTask(input.title, input.description);
        await appendMessage({
          sessionId: session.id,
          role: "event",
          kind: "status",
          agentSlug: active.slug,
          body: `Task created: ${input.title}`,
          meta: { paperclipIssueId: issueId, taskTitle: input.title },
        });
        onEvent({ type: "task_created", issueId, title: input.title, delegated });
        result = delegated
          ? `Task created in the agency's tracker (issue ${issueId}). Let the employee know it's underway.`
          : `Task recorded (ref ${issueId}). The agency tracker is offline right now, but the task is logged with this session.`;
      } else if (block.name === "create_job_req") {
        result = await doCreateJobReq(session, profile, active.slug, { title: input.title, objective: input.objective }, onEvent);
      } else if (block.name === "scope_job_req") {
        const raw = block.input as {
          project_id: string;
          deliverables?: string[];
          timeline?: string;
          success_criteria?: string[];
          constraints?: string;
          notes?: string;
        };
        result = await doScopeJobReq(
          session,
          active.slug,
          {
            project_id: raw.project_id,
            deliverables: raw.deliverables ?? [],
            timeline: raw.timeline ?? "",
            success_criteria: raw.success_criteria ?? [],
            constraints: raw.constraints,
            notes: raw.notes,
          },
          onEvent,
        );
      } else if (block.name === "resource_job_req") {
        const raw = block.input as { project_id: string; plan?: Array<{ agent_slug: string; responsibility: string }> };
        result = await doResourceJobReq(
          session,
          active.slug,
          { project_id: raw.project_id, plan: raw.plan ?? [] },
          new Set(roster.map((a) => a.slug)),
          onEvent,
        );
      } else if (block.name === "link_job_req") {
        const raw = block.input as { project_id: string; note?: string };
        result = await doLinkJobReq(session, active.slug, raw, onEvent);
      } else {
        result = `Unknown tool: ${block.name}`;
      }

      results.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }

    messages.push({ role: "user", content: results });
  }

  onEvent({ type: "done", sessionId: session.id, agentSlug: active.slug });
}

async function ceoWelcomeApi(profile: EmployeeProfile): Promise<string> {
  const anthropic = new Anthropic();
  const ceo = await getAgentBySlug("ceo");
  const returning = profile.sessionCount > 0;
  if (!ceo) return `Welcome, ${profile.displayName}.`;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      ceo.persona +
      "\nWrite a short chat welcome message (2-3 sentences). No headers, no lists. " +
      "End by inviting them to say what they need.",
    messages: [
      {
        role: "user",
        content: returning
          ? `A returning employee just opened a new session. What you know about them:\n${renderProfileBlock(profile)}\nWelcome them back personally.`
          : `A new employee just completed intake:\n${renderProfileBlock(profile)}\nWelcome them to the agency for the first time and briefly explain what the agency can do (source digital talent for an hour or forever).`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : `Welcome, ${profile.displayName}.`;
}

export async function runTurn(
  session: Session,
  profile: EmployeeProfile,
  userText: string,
  onEvent: (event: TurnEvent) => void,
): Promise<void> {
  if (useDirectApi) return runTurnApi(session, profile, userText, onEvent);
  return runTurnCli(session, profile, userText, onEvent);
}

export async function ceoWelcome(profile: EmployeeProfile): Promise<string> {
  if (useDirectApi) return ceoWelcomeApi(profile);
  const ceo = await getAgentBySlug("ceo");
  if (!ceo) return `Welcome, ${profile.displayName}.`;
  return ceoWelcomeCli(ceo, profile);
}
