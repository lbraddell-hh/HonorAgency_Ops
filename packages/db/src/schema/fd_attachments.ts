import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { fdEmployeeProfiles } from "./fd_employee_profiles.js";
import { fdSessions } from "./fd_sessions.js";

export const fdAttachments = pgTable(
  "fd_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => fdSessions.id),
    profileId: uuid("profile_id").notNull().references(() => fdEmployeeProfiles.id),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    // GCP-ready storage addressing: local disk now, swap provider/objectKey later.
    provider: text("provider").notNull().default("local"),
    objectKey: text("object_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionIdx: index("fd_attachments_session_idx").on(table.sessionId, table.createdAt),
  }),
);
