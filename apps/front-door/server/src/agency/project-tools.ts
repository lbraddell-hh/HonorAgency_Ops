import type { FdProjectScope } from "@paperclipai/db";
import {
  createProject,
  getProject,
  linkSessionToProject,
  resourceProject,
  updateProjectScope,
  type Project,
} from "../projects-store.js";
import { appendMessage, type EmployeeProfile, type Session } from "../store.js";
import { createPaperclipTask, type TurnEvent } from "./shared.js";

/**
 * Job-req tool implementations shared by both engine backends. Each persists a
 * `project` event row (so the transcript shows the milestone) and emits an SSE
 * event, then returns the tool-result string for the model.
 */

async function recordProjectEvent(
  session: Session,
  agentSlug: string,
  project: Project,
  action: "created" | "scoped" | "resourced" | "linked",
  detail: string,
  onEvent: (event: TurnEvent) => void,
): Promise<void> {
  await appendMessage({
    sessionId: session.id,
    role: "event",
    kind: "project",
    agentSlug,
    body: detail,
    meta: { projectId: project.id, projectTitle: project.title, projectAction: action, detail },
  });
  onEvent({ type: "project", action, projectId: project.id, title: project.title, detail });
}

export async function doCreateJobReq(
  session: Session,
  profile: EmployeeProfile,
  agentSlug: string,
  input: { title: string; objective: string },
  onEvent: (event: TurnEvent) => void,
): Promise<string> {
  const project = await createProject(profile.id, input.title.trim(), input.objective.trim(), session.id);
  await recordProjectEvent(session, agentSlug, project, "created", input.objective.trim(), onEvent);
  return (
    `Job req created (id: ${project.id}, status: draft) and linked to this session. ` +
    `Now ask clarifying questions until you can scope it: deliverables, timeline, success criteria.`
  );
}

export async function doScopeJobReq(
  session: Session,
  agentSlug: string,
  input: {
    project_id: string;
    deliverables: string[];
    timeline: string;
    success_criteria: string[];
    constraints?: string;
    notes?: string;
  },
  onEvent: (event: TurnEvent) => void,
): Promise<string> {
  const project = await getProject(input.project_id);
  if (!project) return `No job req with id ${input.project_id}.`;
  const scope: FdProjectScope = {
    deliverables: input.deliverables.map((d) => d.trim()).filter(Boolean),
    timeline: input.timeline.trim(),
    successCriteria: input.success_criteria.map((s) => s.trim()).filter(Boolean),
    constraints: input.constraints?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  };
  const updated = await updateProjectScope(project.id, scope);
  const detail = `${scope.deliverables.length} deliverable(s) · ${scope.timeline || "timeline TBD"}`;
  await recordProjectEvent(session, agentSlug, updated ?? project, "scoped", detail, onEvent);
  return (
    `Job req "${project.title}" is now scoped (status: scoped). ` +
    `Summarize the scope back to the employee, then resource it with resource_job_req.`
  );
}

export async function doResourceJobReq(
  session: Session,
  agentSlug: string,
  input: { project_id: string; plan: Array<{ agent_slug: string; responsibility: string }> },
  validSlugs: Set<string>,
  onEvent: (event: TurnEvent) => void,
): Promise<string> {
  const project = await getProject(input.project_id);
  if (!project) return `No job req with id ${input.project_id}.`;
  const plan = input.plan.filter((p) => p.responsibility?.trim());
  const invalid = plan.filter((p) => !validSlugs.has(p.agent_slug));
  if (invalid.length) {
    return `Unknown agent slug(s): ${invalid.map((p) => p.agent_slug).join(", ")}. Valid: ${[...validSlugs].join(", ")}.`;
  }
  const withIssues = [];
  for (const item of plan) {
    const { issueId } = await createPaperclipTask(
      `${project.title}: ${item.responsibility}`,
      `Job req ${project.id} — assigned to ${item.agent_slug}. ${item.responsibility}`,
    );
    withIssues.push({ agentSlug: item.agent_slug, responsibility: item.responsibility, paperclipIssueId: issueId });
  }
  await resourceProject(project.id, withIssues);
  const detail = withIssues.map((t) => `${t.agentSlug}: ${t.responsibility}`).join(" · ");
  await recordProjectEvent(session, agentSlug, project, "resourced", detail, onEvent);
  return (
    `Job req "${project.title}" is resourced (status: resourced) with ${withIssues.length} assignment(s), each tracked as a task. ` +
    `Tell the employee who is on it and what happens next.`
  );
}

export async function doLinkJobReq(
  session: Session,
  agentSlug: string,
  input: { project_id: string; note?: string },
  onEvent: (event: TurnEvent) => void,
): Promise<string> {
  const project = await getProject(input.project_id);
  if (!project) return `No job req with id ${input.project_id}.`;
  await linkSessionToProject(session.id, project.id, input.note);
  await recordProjectEvent(session, agentSlug, project, "linked", input.note ?? "Discussed in this session", onEvent);
  return `This session is now linked to job req "${project.title}" (${project.status}).`;
}
