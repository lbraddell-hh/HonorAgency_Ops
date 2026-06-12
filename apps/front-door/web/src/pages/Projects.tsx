import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, storedProfileId, type Agent, type Project, type ProjectDetail } from "../lib/api";
import { Avatar } from "../components/Avatar";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gold-soft text-[#7a5500]",
  scoped: "bg-sky/15 text-[#1d6ea3]",
  resourced: "bg-sage/20 text-[#3e6b51]",
  closed: "bg-plum-soft text-plum",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] ?? "bg-plum-soft text-plum"}`}>
      {status}
    </span>
  );
}

function ProjectDetailPanel({ projectId, agents }: { projectId: string; agents: Agent[] }) {
  const [detail, setDetail] = useState<ProjectDetail>();
  const [shareEmail, setShareEmail] = useState("");
  const [shareError, setShareError] = useState<string>();
  const bySlug = new Map(agents.map((a) => [a.slug, a]));

  useEffect(() => {
    api.getProject(projectId).then(setDetail);
  }, [projectId]);

  if (!detail) return <p className="px-1 py-3 text-sm text-ink-soft">Loading…</p>;
  const { project, members, tasks, sessions } = detail;
  const scope = project.scope;

  const share = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError(undefined);
    try {
      setDetail(await api.shareProject(projectId, shareEmail));
      setShareEmail("");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "share failed");
    }
  };

  return (
    <div className="space-y-4 border-t border-ink/6 pt-4">
      {(scope.deliverables.length > 0 || scope.timeline || scope.successCriteria.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {scope.deliverables.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Deliverables</h4>
              <ul className="mt-1.5 space-y-1 text-sm text-ink">
                {scope.deliverables.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="text-plum">•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-3">
            {scope.timeline && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Timeline</h4>
                <p className="mt-1 text-sm text-ink">{scope.timeline}</p>
              </div>
            )}
            {scope.successCriteria.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Success criteria</h4>
                <ul className="mt-1 space-y-1 text-sm text-ink">
                  {scope.successCriteria.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="text-gold">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scope.constraints && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Constraints</h4>
                <p className="mt-1 text-sm text-ink">{scope.constraints}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Resourced team</h4>
          <div className="mt-2 space-y-2">
            {tasks.map((t) => {
              const agent = bySlug.get(t.agentSlug);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-card border border-ink/6 bg-cream/60 px-3 py-2">
                  <Avatar avatar={agent?.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-ink">{agent?.displayName ?? t.agentSlug}</span>
                    <span className="ml-2 text-sm text-ink-soft">{t.responsibility}</span>
                  </div>
                  {t.paperclipIssueId && <span className="shrink-0 text-[11px] text-ink-soft">#{t.paperclipIssueId.slice(0, 8)}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Shared with</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => (
              <span key={m.profileId} className="rounded-full bg-plum-soft px-3 py-1 text-[12px] font-medium text-plum">
                {m.displayName}
                {m.role === "owner" && <span className="ml-1 opacity-60">(owner)</span>}
              </span>
            ))}
          </div>
        </div>
        <form onSubmit={share} className="flex items-center gap-2">
          <input
            type="email"
            required
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="colleague@honorhealth.com"
            className="w-56 rounded-full border border-ink/15 bg-white px-4 py-1.5 text-sm outline-none focus:border-plum/60"
          />
          <button type="submit" className="rounded-full bg-plum px-4 py-1.5 text-sm font-semibold text-white hover:bg-plum-deep">
            Share
          </button>
        </form>
      </div>
      {shareError && <p className="text-xs text-coral">{shareError}</p>}

      {sessions.length > 0 && (
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Sessions touching this job req</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {sessions.map((s) => (
              <Link
                key={s.id}
                to={`/chat/${s.id}`}
                className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[12px] font-medium text-ink hover:border-plum/40"
              >
                {new Date(s.createdAt).toLocaleDateString()} · {s.status}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [openId, setOpenId] = useState<string>();

  useEffect(() => {
    const id = storedProfileId.get();
    if (!id) {
      navigate("/");
      return;
    }
    api.listProjects(id).then(setProjects);
    api.listAgents().then(setAgents);
  }, [navigate]);

  return (
    <div className="py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-plum">Job reqs</p>
      <h1 className="mt-2 font-editorial text-3xl text-ink sm:text-4xl">Work the agency is on</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Every job req Honor has opened for you — scoped, resourced, and shareable with colleagues.
        Start a chat to open a new one.
      </p>

      <div className="mt-8 space-y-4">
        {projects.length === 0 && (
          <p className="text-sm text-ink-soft">
            No job reqs yet — tell Honor what you need and he'll open one.
          </p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="rounded-card border border-ink/8 bg-white p-5 shadow-card">
            <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(openId === p.id ? undefined : p.id)}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-ink">{p.title}</h2>
                  <StatusBadge status={p.status} />
                  {p.role === "collaborator" && (
                    <span className="text-[11px] font-semibold text-ink-soft">shared with you</span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{p.objective}</p>
              </div>
              <span className="mt-1 shrink-0 text-ink-soft">{openId === p.id ? "▴" : "▾"}</span>
            </button>
            {openId === p.id && <ProjectDetailPanel projectId={p.id} agents={agents} />}
          </div>
        ))}
      </div>
    </div>
  );
}
