import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { fdSessions } from "./fd_sessions.js";

export interface FdMessageMeta {
  fromAgent?: string;
  toAgent?: string;
  reason?: string;
  briefing?: string;
  paperclipIssueId?: string;
  taskTitle?: string;
  options?: string[];
  attachmentId?: string;
  mimeType?: string;
  projectId?: string;
  projectTitle?: string;
  projectAction?: "created" | "scoped" | "resourced" | "linked";
  detail?: string;
  [key: string]: unknown;
}

export const fdMessages = pgTable(
  "fd_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => fdSessions.id),
    seq: integer("seq").notNull(),
    role: text("role").notNull(),
    agentSlug: text("agent_slug"),
    kind: text("kind").notNull().default("text"),
    body: text("body").notNull(),
    meta: jsonb("meta").$type<FdMessageMeta>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionSeqIdx: index("fd_messages_session_seq_idx").on(table.sessionId, table.seq),
  }),
);
