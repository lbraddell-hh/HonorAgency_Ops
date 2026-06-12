export interface Learned {
  interests: string[];
  priorities: string[];
  communicationStyle: string;
  notes: string[];
}

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  title: string | null;
  department: string | null;
  reportsToName: string | null;
  learned: Learned;
  sessionCount: number;
  lastSessionAt: string | null;
}

export interface AgentAvatar {
  motif: string;
  primaryColor: string;
  accentColor: string;
  initials: string;
}

export interface Agent {
  slug: string;
  displayName: string;
  role: string;
  tagline: string;
  audience: string;
  avatar: AgentAvatar;
  voice: { rate: number; pitch: number; preferredVoiceName: string | null };
}

export interface Session {
  id: string;
  profileId: string;
  status: string;
  activeAgentSlug: string;
  summary: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  seq: number;
  role: "user" | "agent" | "event";
  agentSlug: string | null;
  kind: "text" | "handoff" | "handback" | "status" | "choices" | "file" | "project";
  body: string;
  meta: Record<string, unknown>;
}

export interface Attachment {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}

export interface ProjectScope {
  deliverables: string[];
  timeline: string;
  successCriteria: string[];
  constraints: string;
  notes: string;
}

export interface Project {
  id: string;
  title: string;
  objective: string;
  status: "draft" | "scoped" | "resourced" | "closed";
  scope: ProjectScope;
  createdAt: string;
  updatedAt: string;
  role?: string;
}

export interface ProjectTask {
  id: string;
  agentSlug: string;
  responsibility: string;
  paperclipIssueId: string | null;
  status: string;
}

export interface ProjectDetail {
  project: Project;
  members: Array<{ role: string; profileId: string; displayName: string; email: string }>;
  tasks: ProjectTask[];
  sessions: Array<{ id: string; createdAt: string; status: string; summary: string | null }>;
}

export type TurnEvent =
  | { type: "start"; sessionId: string; agentSlug: string }
  | { type: "chunk"; text: string; agentSlug: string }
  | { type: "status"; text: string }
  | { type: "handoff"; from: string; to: string; toName: string; toRole: string; reason: string }
  | { type: "handback"; from: string; to: string; summary: string }
  | { type: "task_created"; issueId: string; title: string; delegated: boolean }
  | { type: "choices"; options: string[] }
  | { type: "project"; action: "created" | "scoped" | "resourced" | "linked"; projectId: string; title: string; detail?: string }
  | { type: "done"; sessionId: string; agentSlug: string }
  | { type: "error"; message: string };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json() as Promise<T>;
}

export const api = {
  createProfile: (input: { email: string; displayName: string; title?: string; department?: string }) =>
    fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<Profile>(r)),

  getProfile: (id: string) => fetch(`/api/profiles/${id}`).then((r) => json<Profile>(r)),

  updateProfile: (id: string, fields: { displayName?: string; title?: string; department?: string; reportsToName?: string }) =>
    fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then((r) => json<Profile>(r)),

  forgetLearned: (id: string, field: string, value: string) =>
    fetch(`/api/profiles/${id}/learned`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value }),
    }).then((r) => json<Profile>(r)),

  editLearned: (id: string, field: string, value: string, newValue: string) =>
    fetch(`/api/profiles/${id}/learned`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, value, newValue }),
    }).then((r) => json<Profile>(r)),

  listSessions: (profileId: string) =>
    fetch(`/api/profiles/${profileId}/sessions`).then((r) => json<Session[]>(r)),

  listAgents: () => fetch("/api/agents").then((r) => json<Agent[]>(r)),

  createSession: (profileId: string) =>
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    }).then((r) => json<{ session: Session; messages: Message[] }>(r)),

  getSession: (id: string) => fetch(`/api/sessions/${id}`).then((r) => json<Session>(r)),

  getMessages: (id: string) => fetch(`/api/sessions/${id}/messages`).then((r) => json<Message[]>(r)),

  uploadAttachment: (sessionId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`/api/sessions/${sessionId}/attachments`, { method: "POST", body: form }).then((r) =>
      json<{ attachment: Attachment; message: Message }>(r),
    );
  },

  listProjects: (profileId: string) =>
    fetch(`/api/profiles/${profileId}/projects`).then((r) => json<Project[]>(r)),

  getProject: (id: string) => fetch(`/api/projects/${id}`).then((r) => json<ProjectDetail>(r)),

  shareProject: (id: string, email: string) =>
    fetch(`/api/projects/${id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).then((r) => json<ProjectDetail>(r)),

  closeSession: (id: string) =>
    fetch(`/api/sessions/${id}/close`, { method: "POST" }).then((r) =>
      json<{ summary?: string; profile?: Profile; alreadyClosed?: boolean }>(r),
    ),

  async sendMessage(sessionId: string, text: string, onEvent: (event: TurnEvent) => void): Promise<void> {
    const res = await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        onEvent(JSON.parse(line.slice(6)) as TurnEvent);
      }
    }
  },
};

const PROFILE_KEY = "fd.profileId";
export const storedProfileId = {
  get: () => localStorage.getItem(PROFILE_KEY),
  set: (id: string) => localStorage.setItem(PROFILE_KEY, id),
  clear: () => localStorage.removeItem(PROFILE_KEY),
};
