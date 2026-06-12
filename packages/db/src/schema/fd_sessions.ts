import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { fdEmployeeProfiles } from "./fd_employee_profiles.js";

export const fdSessions = pgTable(
  "fd_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => fdEmployeeProfiles.id),
    status: text("status").notNull().default("active"),
    activeAgentSlug: text("active_agent_slug").notNull().default("ceo"),
    title: text("title"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    profileIdx: index("fd_sessions_profile_idx").on(table.profileId, table.createdAt),
  }),
);
