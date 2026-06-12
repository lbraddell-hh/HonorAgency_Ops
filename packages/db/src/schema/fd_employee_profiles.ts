import { pgTable, uuid, text, integer, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

export interface FdLearnedProfile {
  interests: string[];
  priorities: string[];
  communicationStyle: string;
  notes: string[];
}

export const fdEmployeeProfiles = pgTable(
  "fd_employee_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    title: text("title"),
    department: text("department"),
    reportsToName: text("reports_to_name"),
    learned: jsonb("learned")
      .$type<FdLearnedProfile>()
      .notNull()
      .default({ interests: [], priorities: [], communicationStyle: "", notes: [] }),
    sessionCount: integer("session_count").notNull().default(0),
    lastSessionAt: timestamp("last_session_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("fd_employee_profiles_email_idx").on(table.email),
  }),
);
