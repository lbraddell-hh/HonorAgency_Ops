import { createDb } from "@paperclipai/db";
import { env } from "./env.js";

export const db = createDb(env.databaseUrl);
export type Db = typeof db;
