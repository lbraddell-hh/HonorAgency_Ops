import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  fdProjectMembers,
  fdProjects,
  fdProjectTasks,
  fdSessionProjects,
  fdSessions,
  type FdProjectScope,
} from "@paperclipai/db";
import { db } from "./db.js";
import { getProfileByEmail, type EmployeeProfile } from "./store.js";

export type Project = typeof fdProjects.$inferSelect;
export type ProjectTask = typeof fdProjectTasks.$inferSelect;
export type ProjectMember = typeof fdProjectMembers.$inferSelect;

export async function createProject(
  profileId: string,
  title: string,
  objective: string,
  sessionId?: string,
): Promise<Project> {
  const [project] = await db
    .insert(fdProjects)
    .values({ title, objective, createdByProfileId: profileId })
    .returning();
  await db.insert(fdProjectMembers).values({ projectId: project.id, profileId, role: "owner" });
  if (sessionId) await linkSessionToProject(sessionId, project.id);
  return project;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.query.fdProjects.findFirst({ where: eq(fdProjects.id, id) });
}

export async function listProjectsForProfile(profileId: string): Promise<Array<Project & { role: string }>> {
  const memberships = await db.query.fdProjectMembers.findMany({
    where: eq(fdProjectMembers.profileId, profileId),
  });
  if (!memberships.length) return [];
  const projects = await db.query.fdProjects.findMany({
    where: inArray(fdProjects.id, memberships.map((m) => m.projectId)),
    orderBy: [desc(fdProjects.updatedAt)],
  });
  const roleByProject = new Map(memberships.map((m) => [m.projectId, m.role]));
  return projects.map((p) => ({ ...p, role: roleByProject.get(p.id) ?? "collaborator" }));
}

export async function openProjectsForProfile(profileId: string): Promise<Project[]> {
  const all = await listProjectsForProfile(profileId);
  return all.filter((p) => p.status !== "closed");
}

export async function updateProjectScope(
  id: string,
  scope: FdProjectScope,
  objective?: string,
): Promise<Project | undefined> {
  const [updated] = await db
    .update(fdProjects)
    .set({ scope, status: "scoped", ...(objective ? { objective } : {}), updatedAt: new Date() })
    .where(eq(fdProjects.id, id))
    .returning();
  return updated;
}

export async function resourceProject(
  id: string,
  plan: Array<{ agentSlug: string; responsibility: string; paperclipIssueId?: string | null }>,
): Promise<ProjectTask[]> {
  const tasks = plan.length
    ? await db
        .insert(fdProjectTasks)
        .values(plan.map((p) => ({ projectId: id, agentSlug: p.agentSlug, responsibility: p.responsibility, paperclipIssueId: p.paperclipIssueId ?? null })))
        .returning()
    : [];
  await db.update(fdProjects).set({ status: "resourced", updatedAt: new Date() }).where(eq(fdProjects.id, id));
  return tasks;
}

export async function linkSessionToProject(sessionId: string, projectId: string, note?: string): Promise<void> {
  await db
    .insert(fdSessionProjects)
    .values({ sessionId, projectId, note: note ?? null })
    .onConflictDoNothing();
}

export async function addProjectMember(
  projectId: string,
  email: string,
): Promise<{ ok: true; profile: EmployeeProfile } | { ok: false; error: string }> {
  const profile = await getProfileByEmail(email);
  if (!profile) return { ok: false, error: "No employee profile with that email — they need to visit the front door once first." };
  await db
    .insert(fdProjectMembers)
    .values({ projectId, profileId: profile.id, role: "collaborator" })
    .onConflictDoNothing();
  return { ok: true, profile };
}

export async function getProjectDetail(id: string) {
  const project = await getProject(id);
  if (!project) return undefined;
  const [members, tasks, links] = await Promise.all([
    db.query.fdProjectMembers.findMany({ where: eq(fdProjectMembers.projectId, id) }),
    db.query.fdProjectTasks.findMany({ where: eq(fdProjectTasks.projectId, id) }),
    db.query.fdSessionProjects.findMany({ where: eq(fdSessionProjects.projectId, id) }),
  ]);
  const memberProfiles = members.length
    ? await db.query.fdEmployeeProfiles.findMany({
        where: (t) => inArray(t.id, members.map((m) => m.profileId)),
      })
    : [];
  const sessions = links.length
    ? await db.query.fdSessions.findMany({ where: inArray(fdSessions.id, links.map((l) => l.sessionId)) })
    : [];
  const profileById = new Map(memberProfiles.map((p) => [p.id, p]));
  return {
    project,
    members: members.map((m) => ({
      role: m.role,
      profileId: m.profileId,
      displayName: profileById.get(m.profileId)?.displayName ?? "Unknown",
      email: profileById.get(m.profileId)?.email ?? "",
    })),
    tasks,
    sessions: sessions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((s) => ({ id: s.id, createdAt: s.createdAt, status: s.status, summary: s.summary })),
  };
}

export async function projectsLinkedToSession(sessionId: string): Promise<Project[]> {
  const links = await db.query.fdSessionProjects.findMany({ where: eq(fdSessionProjects.sessionId, sessionId) });
  if (!links.length) return [];
  return db.query.fdProjects.findMany({ where: inArray(fdProjects.id, links.map((l) => l.projectId)) });
}
