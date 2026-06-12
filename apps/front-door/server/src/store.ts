import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  fdAgentProfiles,
  fdEmployeeProfiles,
  fdMessages,
  fdSessions,
  type FdLearnedProfile,
  type FdMessageMeta,
} from "@paperclipai/db";
import { db } from "./db.js";

export type AgentProfile = typeof fdAgentProfiles.$inferSelect;
export type EmployeeProfile = typeof fdEmployeeProfiles.$inferSelect;
export type Session = typeof fdSessions.$inferSelect;
export type Message = typeof fdMessages.$inferSelect;

export async function upsertProfile(input: {
  email: string;
  displayName: string;
  title?: string | null;
  department?: string | null;
  reportsToName?: string | null;
}): Promise<EmployeeProfile> {
  const email = input.email.trim().toLowerCase();
  const existing = await db.query.fdEmployeeProfiles.findFirst({
    where: eq(fdEmployeeProfiles.email, email),
  });
  if (existing) {
    const [updated] = await db
      .update(fdEmployeeProfiles)
      .set({
        displayName: input.displayName || existing.displayName,
        title: input.title ?? existing.title,
        department: input.department ?? existing.department,
        reportsToName: input.reportsToName ?? existing.reportsToName,
        updatedAt: new Date(),
      })
      .where(eq(fdEmployeeProfiles.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(fdEmployeeProfiles)
    .values({
      email,
      displayName: input.displayName,
      title: input.title ?? null,
      department: input.department ?? null,
      reportsToName: input.reportsToName ?? null,
    })
    .returning();
  return created;
}

export async function getProfile(id: string): Promise<EmployeeProfile | undefined> {
  return db.query.fdEmployeeProfiles.findFirst({ where: eq(fdEmployeeProfiles.id, id) });
}

export async function getProfileByEmail(email: string): Promise<EmployeeProfile | undefined> {
  return db.query.fdEmployeeProfiles.findFirst({
    where: eq(fdEmployeeProfiles.email, email.trim().toLowerCase()),
  });
}

export async function updateLearned(profileId: string, learned: FdLearnedProfile): Promise<void> {
  await db
    .update(fdEmployeeProfiles)
    .set({
      learned,
      sessionCount: sql`${fdEmployeeProfiles.sessionCount} + 1`,
      lastSessionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(fdEmployeeProfiles.id, profileId));
}

export async function setLearned(profileId: string, learned: FdLearnedProfile): Promise<void> {
  await db
    .update(fdEmployeeProfiles)
    .set({ learned, updatedAt: new Date() })
    .where(eq(fdEmployeeProfiles.id, profileId));
}

export async function listAgents(): Promise<AgentProfile[]> {
  return db.query.fdAgentProfiles.findMany({
    where: eq(fdAgentProfiles.isActive, true),
    orderBy: [asc(fdAgentProfiles.sortOrder)],
  });
}

export async function getAgentBySlug(slug: string): Promise<AgentProfile | undefined> {
  return db.query.fdAgentProfiles.findFirst({ where: eq(fdAgentProfiles.slug, slug) });
}

export async function createSession(
  profileId: string,
  openingAgentSlug = "ceo",
): Promise<Session> {
  const [session] = await db
    .insert(fdSessions)
    .values({ profileId, activeAgentSlug: openingAgentSlug })
    .returning();
  return session;
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.query.fdSessions.findFirst({ where: eq(fdSessions.id, id) });
}

export async function setActiveAgent(sessionId: string, slug: string): Promise<void> {
  await db.update(fdSessions).set({ activeAgentSlug: slug }).where(eq(fdSessions.id, sessionId));
}

export async function closeSession(sessionId: string, summary: string | null): Promise<void> {
  await db
    .update(fdSessions)
    .set({ status: "closed", summary, closedAt: new Date() })
    .where(eq(fdSessions.id, sessionId));
}

export async function listSessionsForProfile(profileId: string): Promise<Session[]> {
  return db.query.fdSessions.findMany({
    where: eq(fdSessions.profileId, profileId),
    orderBy: [desc(fdSessions.createdAt)],
  });
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  return db.query.fdMessages.findMany({
    where: eq(fdMessages.sessionId, sessionId),
    orderBy: [asc(fdMessages.seq)],
  });
}

export async function appendMessage(input: {
  sessionId: string;
  role: "user" | "agent" | "event";
  agentSlug?: string | null;
  kind?: "text" | "handoff" | "handback" | "status" | "choices" | "file" | "project";
  body: string;
  meta?: FdMessageMeta;
}): Promise<Message> {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${fdMessages.seq}), 0) + 1` })
    .from(fdMessages)
    .where(eq(fdMessages.sessionId, input.sessionId));
  const [created] = await db
    .insert(fdMessages)
    .values({
      sessionId: input.sessionId,
      seq: next,
      role: input.role,
      agentSlug: input.agentSlug ?? null,
      kind: input.kind ?? "text",
      body: input.body,
      meta: input.meta ?? {},
    })
    .returning();
  return created;
}

export async function updateProfileFields(
  id: string,
  fields: { displayName?: string; title?: string | null; department?: string | null; reportsToName?: string | null },
): Promise<EmployeeProfile | undefined> {
  const existing = await getProfile(id);
  if (!existing) return undefined;
  const [updated] = await db
    .update(fdEmployeeProfiles)
    .set({
      displayName: fields.displayName?.trim() || existing.displayName,
      title: fields.title !== undefined ? fields.title : existing.title,
      department: fields.department !== undefined ? fields.department : existing.department,
      reportsToName: fields.reportsToName !== undefined ? fields.reportsToName : existing.reportsToName,
      updatedAt: new Date(),
    })
    .where(eq(fdEmployeeProfiles.id, id))
    .returning();
  return updated;
}

export async function editLearnedItem(
  profileId: string,
  field: keyof FdLearnedProfile,
  oldValue: string,
  newValue: string,
): Promise<EmployeeProfile | undefined> {
  const profile = await getProfile(profileId);
  if (!profile) return undefined;
  const learned = { ...profile.learned };
  const trimmed = newValue.trim();
  if (field === "communicationStyle") {
    learned.communicationStyle = trimmed;
  } else {
    learned[field] = (learned[field] as string[]).map((v) => (v === oldValue ? trimmed : v)).filter(Boolean);
  }
  await setLearned(profileId, learned);
  return getProfile(profileId);
}

export async function deleteLearnedNote(profileId: string, field: keyof FdLearnedProfile, value: string): Promise<EmployeeProfile | undefined> {
  const profile = await getProfile(profileId);
  if (!profile) return undefined;
  const learned = { ...profile.learned };
  if (field === "communicationStyle") {
    learned.communicationStyle = "";
  } else {
    learned[field] = (learned[field] as string[]).filter((v) => v !== value);
  }
  await setLearned(profileId, learned);
  return getProfile(profileId);
}
