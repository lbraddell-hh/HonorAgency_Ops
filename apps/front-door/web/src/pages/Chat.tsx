import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, storedProfileId, type Agent, type Message, type Profile, type Session } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speech";
import { Avatar } from "../components/Avatar";
import { Composer } from "../components/Composer";
import { AgentBubble, ChoiceChips, FileBubble, HandoffCard, ProjectCard, TaskChip, UserBubble } from "../components/MessageParts";

type Item =
  | { kind: "user"; text: string }
  | { kind: "agent"; agentSlug: string; text: string; streaming: boolean }
  | { kind: "handoff"; from: string; to: string; reason: string; handback: boolean }
  | { kind: "task"; title: string; issueId: string }
  | { kind: "choices"; options: string[] }
  | { kind: "file"; filename: string; mimeType: string; attachmentId: string }
  | { kind: "project"; action: string; title: string; detail?: string };

function itemsFromMessages(messages: Message[]): Item[] {
  const items: Item[] = [];
  for (const m of messages) {
    if (m.kind === "file" && m.meta.attachmentId)
      items.push({ kind: "file", filename: m.body, mimeType: String(m.meta.mimeType ?? ""), attachmentId: String(m.meta.attachmentId) });
    else if (m.role === "user") items.push({ kind: "user", text: m.body });
    else if (m.role === "agent") items.push({ kind: "agent", agentSlug: m.agentSlug ?? "ceo", text: m.body, streaming: false });
    else if (m.kind === "handoff")
      items.push({ kind: "handoff", from: String(m.meta.fromAgent ?? "ceo"), to: String(m.meta.toAgent ?? ""), reason: String(m.meta.reason ?? m.body), handback: false });
    else if (m.kind === "handback")
      items.push({ kind: "handoff", from: String(m.meta.fromAgent ?? ""), to: "ceo", reason: String(m.meta.reason ?? m.body), handback: true });
    else if (m.kind === "status" && m.meta.taskTitle)
      items.push({ kind: "task", title: String(m.meta.taskTitle), issueId: String(m.meta.paperclipIssueId ?? "") });
    else if (m.kind === "choices" && Array.isArray(m.meta.options))
      items.push({ kind: "choices", options: (m.meta.options as string[]).map(String) });
    else if (m.kind === "project")
      items.push({
        kind: "project",
        action: String(m.meta.projectAction ?? "created"),
        title: String(m.meta.projectTitle ?? ""),
        detail: m.body || undefined,
      });
  }
  return items;
}

export function Chat() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>();
  const [profile, setProfile] = useState<Profile>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeSummary, setCloseSummary] = useState<string>();
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;
  const bottomRef = useRef<HTMLDivElement>(null);

  const bySlug = useMemo(() => new Map(agents.map((a) => [a.slug, a])), [agents]);
  // Quick replies stay live until the user answers (by chip or free text).
  const liveChoicesIndex = useMemo(() => {
    let index = -1;
    items.forEach((item, i) => {
      if (item.kind === "choices") index = i;
      if (item.kind === "user") index = -1;
    });
    return index;
  }, [items]);
  const lastAgentSlug = [...items].reverse().find((i): i is Item & { kind: "agent" } => i.kind === "agent")?.agentSlug;
  const activeAgent = bySlug.get(lastAgentSlug ?? session?.activeAgentSlug ?? "ceo");

  useEffect(() => {
    api.listAgents().then(setAgents);
    api.getSession(sessionId).then((s) => {
      setSession(s);
      api.getProfile(s.profileId).then(setProfile);
    });
    api.getMessages(sessionId).then((messages) => setItems(itemsFromMessages(messages)));
    return () => stopSpeaking();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const maybeSpeak = (agentSlug: string, text: string) => {
    if (!voiceModeRef.current || !text.trim()) return;
    const agent = bySlug.get(agentSlug);
    if (agent) speak(text, agent.voice);
  };

  const send = async (text: string) => {
    if (sending) return;
    setSending(true);
    stopSpeaking();
    setItems((prev) => [...prev, { kind: "user", text }]);
    try {
      await api.sendMessage(sessionId, text, (event) => {
        setItems((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          switch (event.type) {
            case "chunk": {
              if (last?.kind === "agent" && last.streaming && last.agentSlug === event.agentSlug) {
                next[next.length - 1] = { ...last, text: last.text + event.text };
              } else {
                if (last?.kind === "agent" && last.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                  maybeSpeak(last.agentSlug, last.text);
                }
                next.push({ kind: "agent", agentSlug: event.agentSlug, text: event.text, streaming: true });
              }
              return next;
            }
            case "handoff":
            case "handback": {
              if (last?.kind === "agent" && last.streaming) {
                next[next.length - 1] = { ...last, streaming: false };
                maybeSpeak(last.agentSlug, last.text);
              }
              if (event.type === "handoff") {
                next.push({ kind: "handoff", from: event.from, to: event.to, reason: event.reason, handback: false });
              } else {
                next.push({ kind: "handoff", from: event.from, to: event.to, reason: event.summary, handback: true });
              }
              return next;
            }
            case "task_created":
              next.push({ kind: "task", title: event.title, issueId: event.issueId });
              return next;
            case "choices": {
              if (last?.kind === "agent" && last.streaming) {
                next[next.length - 1] = { ...last, streaming: false };
                maybeSpeak(last.agentSlug, last.text);
              }
              next.push({ kind: "choices", options: event.options });
              return next;
            }
            case "project": {
              if (last?.kind === "agent" && last.streaming) {
                next[next.length - 1] = { ...last, streaming: false };
                maybeSpeak(last.agentSlug, last.text);
              }
              next.push({ kind: "project", action: event.action, title: event.title, detail: event.detail });
              return next;
            }
            case "done": {
              if (last?.kind === "agent" && last.streaming) {
                next[next.length - 1] = { ...last, streaming: false };
                maybeSpeak(last.agentSlug, last.text);
              }
              return next;
            }
            case "error":
              next.push({ kind: "agent", agentSlug: "ceo", text: `Something went wrong: ${event.message}`, streaming: false });
              return next;
            default:
              return next;
          }
        });
      });
    } finally {
      setSending(false);
    }
  };

  const attach = async (file: File) => {
    try {
      const { attachment } = await api.uploadAttachment(sessionId, file);
      setItems((prev) => [
        ...prev,
        { kind: "file", filename: attachment.filename, mimeType: attachment.mimeType, attachmentId: attachment.id },
      ]);
    } catch (error) {
      console.error("upload failed:", error);
    }
  };

  const endSession = async () => {
    setClosing(true);
    stopSpeaking();
    try {
      const result = await api.closeSession(sessionId);
      setCloseSummary(result.summary ?? "Session saved.");
    } finally {
      setClosing(false);
    }
  };

  const isClosed = Boolean(closeSummary) || session?.status === "closed";

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-14 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-ink/8 bg-cream/95 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar avatar={activeAgent?.avatar} size="md" speaking={sending} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-ink">{activeAgent?.displayName ?? "…"}</div>
            <div className="truncate text-xs text-ink-soft">{activeAgent?.role}</div>
          </div>
        </div>
        {!isClosed && (
          <button
            onClick={endSession}
            disabled={closing || sending}
            className="shrink-0 rounded-full border border-plum/30 px-4 py-1.5 text-sm font-semibold text-plum transition-colors hover:bg-plum-soft disabled:opacity-50"
          >
            {closing ? "Saving what we learned…" : "End session"}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 py-6 pb-28">
        {items.map((item, i) => {
          switch (item.kind) {
            case "user":
              return <UserBubble key={i} name={profile?.displayName ?? "You"} text={item.text} />;
            case "agent":
              return (
                <AgentBubble
                  key={i}
                  agent={bySlug.get(item.agentSlug)}
                  text={item.text}
                  streaming={item.streaming}
                  speaking={item.streaming && sending}
                />
              );
            case "handoff":
              return (
                <HandoffCard
                  key={i}
                  fromAgent={bySlug.get(item.from)}
                  toAgent={bySlug.get(item.to)}
                  reason={item.reason}
                  handback={item.handback}
                />
              );
            case "task":
              return <TaskChip key={i} title={item.title} issueId={item.issueId} />;
            case "file":
              return (
                <FileBubble
                  key={i}
                  name={profile?.displayName ?? "You"}
                  filename={item.filename}
                  mimeType={item.mimeType}
                  attachmentId={item.attachmentId}
                />
              );
            case "project":
              return <ProjectCard key={i} action={item.action} title={item.title} detail={item.detail} />;
            case "choices":
              return null; // live choices render pinned below the thread
          }
        })}
        {liveChoicesIndex >= 0 && !isClosed && !sending && (() => {
          const live = items[liveChoicesIndex];
          return live.kind === "choices" ? <ChoiceChips options={live.options} disabled={sending} onPick={send} /> : null;
        })()}
        {closeSummary && (
          <div className="mx-auto max-w-md rounded-card border border-sage/50 bg-white p-4 text-center shadow-card">
            <p className="text-sm font-bold text-sage">Session saved — the agency learned from it</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{closeSummary}</p>
            <button
              onClick={() => navigate("/me")}
              className="mt-3 rounded-full bg-plum px-4 py-1.5 text-sm font-semibold text-white hover:bg-plum-deep"
            >
              See what the agency knows about me
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!isClosed && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink/8 bg-cream/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl">
            <Composer disabled={sending} voiceMode={voiceMode} onToggleVoice={() => setVoiceMode((v) => !v)} onSend={send} onAttach={attach} />
          </div>
        </div>
      )}
    </div>
  );
}
