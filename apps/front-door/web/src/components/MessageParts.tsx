import type { ReactNode } from "react";
import type { Agent } from "../lib/api";
import { Avatar, UserDot } from "./Avatar";

/* Agents are asked not to emit markdown, but render **bold** gracefully when
   it slips through rather than showing raw asterisks. */
function renderInline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export function AgentBubble({
  agent,
  text,
  speaking = false,
  streaming = false,
}: {
  agent: Agent | undefined;
  text: string;
  speaking?: boolean;
  streaming?: boolean;
}) {
  return (
    <div className="flex items-end gap-2.5">
      <Avatar avatar={agent?.avatar} size="sm" speaking={speaking} />
      <div className="max-w-[78%] sm:max-w-[70%]">
        <div className="mb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
          {agent?.displayName ?? "Agent"}
        </div>
        <div className="rounded-card rounded-bl-sm bg-white px-4 py-3 text-[15px] leading-relaxed shadow-card whitespace-pre-wrap">
          {renderInline(text)}
          {streaming && (
            <span className="ml-1 inline-flex gap-0.5 align-baseline">
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-plum" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-plum" />
              <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-plum" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function UserBubble({ name, text }: { name: string; text: string }) {
  return (
    <div className="flex items-end justify-end gap-2.5">
      <div className="max-w-[78%] rounded-card rounded-br-sm bg-plum px-4 py-3 text-[15px] leading-relaxed text-white sm:max-w-[70%] whitespace-pre-wrap">
        {text}
      </div>
      <UserDot name={name} />
    </div>
  );
}

export function HandoffCard({
  fromAgent,
  toAgent,
  reason,
  handback = false,
}: {
  fromAgent: Agent | undefined;
  toAgent: Agent | undefined;
  reason: string;
  handback?: boolean;
}) {
  return (
    <div className="mx-auto my-1 flex w-full max-w-md items-center gap-3 rounded-card border border-plum-soft bg-plum-soft/60 px-4 py-3">
      <div className="flex items-center -space-x-2">
        <Avatar avatar={fromAgent?.avatar} size="sm" />
        <Avatar avatar={toAgent?.avatar} size="sm" />
      </div>
      <div className="min-w-0 text-[13px] leading-snug">
        <div className="font-semibold text-plum">
          {handback
            ? `${fromAgent?.displayName ?? "Specialist"} hands back to ${toAgent?.displayName ?? "the CEO"}`
            : `${fromAgent?.displayName ?? "Sol"} is bringing in ${toAgent?.displayName ?? "a specialist"}${toAgent ? `, ${toAgent.role}` : ""}`}
        </div>
        <div className="text-ink-soft">{reason}</div>
      </div>
    </div>
  );
}

export function ChoiceChips({
  options,
  disabled,
  onPick,
}: {
  options: string[];
  disabled: boolean;
  onPick: (option: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 pl-10">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onPick(option)}
          className="rounded-full border border-plum/40 bg-white px-4 py-2 text-[13px] font-semibold text-plum shadow-card transition-colors hover:bg-plum hover:text-white disabled:opacity-40"
        >
          {option}
        </button>
      ))}
      <span className="basis-full text-right text-[11px] text-ink-soft">or type your own reply below</span>
    </div>
  );
}

export function FileBubble({
  name,
  filename,
  mimeType,
  attachmentId,
}: {
  name: string;
  filename: string;
  mimeType: string;
  attachmentId: string;
}) {
  const url = `/api/attachments/${attachmentId}`;
  const isImage = mimeType.startsWith("image/");
  return (
    <div className="flex items-end justify-end gap-2.5">
      <div className="max-w-[78%] sm:max-w-[60%]">
        {isImage ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={filename} className="max-h-64 rounded-card border border-plum/20 object-cover shadow-card" />
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-card rounded-br-sm border border-plum/20 bg-white px-4 py-3 shadow-card"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-plum-soft text-plum">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{filename}</span>
              <span className="block text-[11px] text-ink-soft">{mimeType}</span>
            </span>
          </a>
        )}
      </div>
      <UserDot name={name} />
    </div>
  );
}

const PROJECT_ACTION_LABEL: Record<string, string> = {
  created: "Job req opened",
  scoped: "Job req scoped",
  resourced: "Job req resourced",
  linked: "Linked to job req",
};

export function ProjectCard({ action, title, detail }: { action: string; title: string; detail?: string }) {
  return (
    <div className="mx-auto my-1 w-full max-w-md rounded-card border-l-4 border border-plum/25 border-l-plum bg-white px-4 py-3 shadow-card">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-plum-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-plum">
          {PROJECT_ACTION_LABEL[action] ?? action}
        </span>
        <span className="truncate text-sm font-bold text-ink">{title}</span>
      </div>
      {detail && <p className="mt-1 text-[12px] leading-snug text-ink-soft">{detail}</p>}
    </div>
  );
}

export function TaskChip({ title, issueId }: { title: string; issueId: string }) {
  return (
    <div className="mx-auto my-1 flex w-fit max-w-md items-center gap-2 rounded-full border border-gold bg-gold-soft px-4 py-1.5 text-[13px]">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8.5 6.5 12 13 4.5" stroke="#9a6a00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-semibold text-[#7a5500]">Task delegated:</span>
      <span className="truncate text-ink">{title}</span>
      <span className="text-ink-soft">#{issueId.slice(0, 8)}</span>
    </div>
  );
}
