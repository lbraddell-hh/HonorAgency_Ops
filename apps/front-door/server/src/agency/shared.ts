import { env } from "../env.js";
import type { AgentProfile, EmployeeProfile, Message } from "../store.js";

export type TurnEvent =
  | { type: "start"; sessionId: string; agentSlug: string }
  | { type: "chunk"; text: string; agentSlug: string }
  | { type: "status"; text: string }
  | { type: "handoff"; from: string; to: string; toName: string; toRole: string; reason: string }
  | { type: "handback"; from: string; to: string; summary: string }
  | { type: "task_created"; issueId: string; title: string; delegated: boolean }
  | { type: "choices"; options: string[] }
  | { type: "project"; action: "created" | "scoped" | "resourced" | "linked"; projectId: string; title: string; detail?: string }
  | { type: "done"; sessionId: string; agentSlug: string }
  | { type: "error"; message: string };

export function renderProfileBlock(profile: EmployeeProfile): string {
  const learned = profile.learned;
  const lines = [
    `Name: ${profile.displayName}`,
    profile.title ? `Title: ${profile.title}` : null,
    profile.department ? `Department: ${profile.department}` : null,
    profile.reportsToName ? `Reports to: ${profile.reportsToName}` : null,
    `Sessions so far: ${profile.sessionCount}`,
    learned.interests.length ? `Interests: ${learned.interests.join("; ")}` : null,
    learned.priorities.length ? `Current priorities: ${learned.priorities.join("; ")}` : null,
    learned.communicationStyle ? `Communication style: ${learned.communicationStyle}` : null,
    learned.notes.length ? `Notes from past sessions: ${learned.notes.join(" | ")}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export interface OpenProjectSummary {
  id: string;
  title: string;
  status: string;
  objective: string;
}

export function buildSystemPrompt(
  active: AgentProfile,
  roster: AgentProfile[],
  profile: EmployeeProfile,
  openProjects: OpenProjectSummary[] = [],
): string {
  const rosterBlock = roster
    .map((a) => `- ${a.slug}: ${a.displayName}, ${a.role} — ${a.tagline}`)
    .join("\n");
  const projectsBlock = openProjects.length
    ? openProjects.map((p) => `- ${p.id} | "${p.title}" | ${p.status} | ${p.objective}`).join("\n")
    : "(none yet)";
  return [
    "You are part of HonorHealth's digital agency — a roster of AI agents that HonorHealth employees",
    "engage through a single chat front door. The agency's CEO owns every relationship; specialists",
    "are brought in via the handoff tool and hand back when done. Tone for everyone: clinical",
    "credibility, calm and structured, never urgent. Avoid jargon. Always guide the next step.",
    "Keep replies conversational and concise (this is a chat surface, and replies may be spoken aloud).",
    "Write in plain conversational text — no markdown headings, no asterisks or bold markers.",
    "When you ask the user a question that has a small set of natural answers (2-4), call the",
    "offer_choices tool with short option labels AFTER writing the question — the user sees them as",
    "tappable buttons and can always type a custom reply instead. Don't repeat the options as text.",
    "",
    `## Active agent`,
    active.persona,
    "",
    `## Agency roster`,
    rosterBlock,
    "",
    `## The employee you are talking with`,
    renderProfileBlock(profile),
    "",
    "## Job reqs — how work gets scoped and resourced",
    "A job req is the unit of work the agency takes on. The CEO drives this protocol:",
    "1. Once the REASON the employee is contacting the agency is clear, call create_job_req with a",
    "   crisp title and one-sentence objective. Don't wait for full detail — draft early.",
    "2. Ask clarifying questions (use offer_choices) until you can define deliverables, a timeline,",
    "   and success criteria — then call scope_job_req. Keep it tight: 2-5 deliverables.",
    "3. Resource it: call resource_job_req assigning roster specialists to responsibilities, then",
    "   tell the employee who is on it and what happens next.",
    "4. If the conversation concerns an existing open job req (listed below), call link_job_req with",
    "   its id instead of creating a duplicate. A single session may touch several job reqs — link",
    "   each one that gets discussed.",
    "",
    "## Open job reqs for this employee",
    projectsBlock,
    "",
    "Use what you know about this employee naturally — reference their priorities and interests",
    "where relevant, and match their communication style. Do not recite their profile back to them.",
    "When a handoff or hand-back tool succeeds, continue speaking AS the new active agent, in that",
    "agent's voice, for the rest of the conversation.",
  ].join("\n");
}

/**
 * Serialize untrusted message bodies into tagged turns so a body containing
 * fake turn markers cannot fabricate history (same guard as Paperclip's
 * board-chat relay).
 */
export function serializeTurn(role: string, body: string): string {
  const safeBody = body.replace(/<(\/?turn\b)/gi, "&lt;$1");
  return `<turn role="${role}">\n${safeBody}\n</turn>`;
}

export function serializeTranscript(messages: Message[], attachmentPaths?: Map<string, string>): string {
  return messages
    .map((m) => {
      if (m.kind === "file") {
        const path = m.meta.attachmentId ? attachmentPaths?.get(m.meta.attachmentId) : undefined;
        return serializeTurn(
          "user",
          `[Shared a file: ${m.body} (${m.meta.mimeType ?? "unknown type"})` +
            (path ? `. Local path: ${path} — use the Read tool to view it when relevant.]` : `]`),
        );
      }
      if (m.role === "user") return serializeTurn("user", m.body);
      if (m.role === "agent") return serializeTurn(`agent:${m.agentSlug}`, m.body);
      if (m.kind === "handoff") {
        return serializeTurn("event", `Handoff: ${m.meta.fromAgent} brought in ${m.meta.toAgent}. Reason: ${m.meta.reason ?? ""}`);
      }
      if (m.kind === "handback") {
        return serializeTurn("event", `Hand-back to CEO. Summary: ${m.meta.reason ?? m.body}`);
      }
      if (m.kind === "project") {
        return serializeTurn("event", `Job req ${m.meta.projectAction}: "${m.meta.projectTitle}" (id ${m.meta.projectId}). ${m.body}`);
      }
      return serializeTurn("event", m.body);
    })
    .join("\n");
}

export async function createPaperclipTask(
  title: string,
  description: string,
): Promise<{ issueId: string; delegated: boolean }> {
  if (env.paperclipApiUrl && env.paperclipApiKey && env.paperclipCompanyId) {
    try {
      const { PaperclipApiClient, normalizeApiUrl } = await import("@paperclipai/mcp-server");
      const client = new PaperclipApiClient({
        apiUrl: normalizeApiUrl(env.paperclipApiUrl),
        apiKey: env.paperclipApiKey,
        companyId: env.paperclipCompanyId,
        agentId: null,
        runId: null,
      });
      const issue = await client.requestJson<{ id: string }>(
        "POST",
        `/companies/${env.paperclipCompanyId}/issues`,
        { body: { title, description } },
      );
      return { issueId: issue.id, delegated: true };
    } catch (error) {
      console.warn("Paperclip task creation failed; falling back to local stub:", error);
    }
  }
  // Demo fallback: the task is recorded in the session transcript but not pushed to Paperclip.
  return { issueId: `local-${crypto.randomUUID().slice(0, 8)}`, delegated: false };
}
