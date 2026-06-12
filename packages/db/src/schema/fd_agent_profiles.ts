import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";

export interface FdAgentAvatar {
  motif: string;
  primaryColor: string;
  accentColor: string;
  initials: string;
}

export interface FdAgentVoice {
  rate: number;
  pitch: number;
  preferredVoiceName: string | null;
}

export const fdAgentProfiles = pgTable(
  "fd_agent_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    tagline: text("tagline").notNull().default(""),
    persona: text("persona").notNull(),
    audience: text("audience").notNull().default(""),
    avatar: jsonb("avatar").$type<FdAgentAvatar>().notNull(),
    voice: jsonb("voice").$type<FdAgentVoice>().notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("fd_agent_profiles_slug_idx").on(table.slug),
  }),
);
