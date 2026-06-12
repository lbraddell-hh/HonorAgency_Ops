import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { fdEmployeeProfiles } from "./fd_employee_profiles.js";
import { fdSessions } from "./fd_sessions.js";

export interface FdProjectScope {
  deliverables: string[];
  timeline: string;
  successCriteria: string[];
  constraints: string;
  notes: string;
}

/** A job req: the scoped unit of work an employee brings to the agency. */
export const fdProjects = pgTable(
  "fd_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    objective: text("objective").notNull().default(""),
    // draft -> scoped -> resourced -> closed
    status: text("status").notNull().default("draft"),
    createdByProfileId: uuid("created_by_profile_id").notNull().references(() => fdEmployeeProfiles.id),
    scope: jsonb("scope")
      .$type<FdProjectScope>()
      .notNull()
      .default({ deliverables: [], timeline: "", successCriteria: [], constraints: "", notes: "" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("fd_projects_status_idx").on(table.status, table.updatedAt),
  }),
);

/** Sharing: a job req is visible to every member, not just its creator. */
export const fdProjectMembers = pgTable(
  "fd_project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => fdProjects.id),
    profileId: uuid("profile_id").notNull().references(() => fdEmployeeProfiles.id),
    role: text("role").notNull().default("collaborator"), // owner | collaborator
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberUq: uniqueIndex("fd_project_members_uq").on(table.projectId, table.profileId),
    profileIdx: index("fd_project_members_profile_idx").on(table.profileId),
  }),
);

/** Many-to-many: one session can touch several job reqs and vice versa. */
export const fdSessionProjects = pgTable(
  "fd_session_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => fdSessions.id),
    projectId: uuid("project_id").notNull().references(() => fdProjects.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    linkUq: uniqueIndex("fd_session_projects_uq").on(table.sessionId, table.projectId),
    projectIdx: index("fd_session_projects_project_idx").on(table.projectId),
  }),
);

/** The CEO's resourcing plan: which roster agent owns which responsibility. */
export const fdProjectTasks = pgTable(
  "fd_project_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => fdProjects.id),
    agentSlug: text("agent_slug").notNull(),
    responsibility: text("responsibility").notNull(),
    paperclipIssueId: text("paperclip_issue_id"),
    status: text("status").notNull().default("planned"), // planned | in_progress | done
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("fd_project_tasks_project_idx").on(table.projectId),
  }),
);
