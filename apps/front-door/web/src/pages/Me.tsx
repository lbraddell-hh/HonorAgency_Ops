import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, storedProfileId, type Profile, type Session } from "../lib/api";

function Chips({
  label,
  field,
  values,
  color,
  onForget,
  onEdit,
}: {
  label: string;
  field: string;
  values: string[];
  color: string;
  onForget: (field: string, value: string) => void;
  onEdit: (field: string, value: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (!values.length) return null;

  const commit = (value: string) => {
    setEditing(null);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onEdit(field, value, trimmed);
  };

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) =>
          editing === value ? (
            <span key={value} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${color}`}>
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(value);
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={() => commit(value)}
                className="w-64 max-w-[60vw] rounded-full bg-white/70 px-3 py-1 text-[13px] font-medium outline-none"
              />
            </span>
          ) : (
            <span key={value} className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${color}`}>
              {value}
              <button
                onClick={() => {
                  setEditing(value);
                  setDraft(value);
                }}
                title="Edit this"
                className="opacity-50 transition-opacity hover:opacity-100"
              >
                ✎
              </button>
              <button onClick={() => onForget(field, value)} title="Forget this" className="opacity-50 transition-opacity hover:opacity-100">
                ✕
              </button>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

const ORG_FIELDS = [
  ["displayName", "Full name"],
  ["title", "Title"],
  ["department", "Department"],
  ["reportsToName", "Reports to"],
] as const;

function OrgCard({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: "", title: "", department: "", reportsToName: "" });
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setDraft({
      displayName: profile.displayName,
      title: profile.title ?? "",
      department: profile.department ?? "",
      reportsToName: profile.reportsToName ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await api.updateProfile(profile.id, draft));
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-ink/8 bg-white p-5 shadow-card md:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">{profile.displayName}</h2>
        {!editing && (
          <button onClick={startEdit} className="rounded-full border border-plum/30 px-3 py-1 text-xs font-semibold text-plum hover:bg-plum-soft">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2.5">
          {ORG_FIELDS.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
              <input
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-full rounded-card border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-plum/60"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy || !draft.displayName.trim()}
              className="rounded-full bg-plum px-4 py-1.5 text-sm font-semibold text-white hover:bg-plum-deep disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-sm font-semibold text-ink-soft hover:text-plum">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm">
            {(
              [
                ["Email", profile.email],
                ["Title", profile.title],
                ["Department", profile.department],
                ["Reports to", profile.reportsToName],
                ["Sessions", String(profile.sessionCount)],
              ] as const
            ).map(([k, v]) =>
              v ? (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ) : null,
            )}
          </dl>
          <p className="mt-4 border-t border-ink/6 pt-3 text-xs text-ink-soft">
            These fields are yours to keep current — the agency reads them at the start of every session.
          </p>
        </>
      )}
    </div>
  );
}

export function Me() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const id = storedProfileId.get();
    if (!id) {
      navigate("/");
      return;
    }
    api.getProfile(id).then(setProfile).catch(() => navigate("/"));
    api.listSessions(id).then(setSessions);
  }, [navigate]);

  const forget = async (field: string, value: string) => {
    if (!profile) return;
    setProfile(await api.forgetLearned(profile.id, field, value));
  };

  const edit = async (field: string, value: string, newValue: string) => {
    if (!profile) return;
    setProfile(await api.editLearned(profile.id, field, value, newValue));
  };

  if (!profile) return null;
  const { learned } = profile;
  const hasLearned =
    learned.interests.length || learned.priorities.length || learned.notes.length || learned.communicationStyle;

  return (
    <div className="py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-plum">My profile</p>
      <h1 className="mt-2 font-editorial text-3xl text-ink sm:text-4xl">
        What the agency knows about me
      </h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-soft">
        Everything here is visible, editable, and forgettable — correct anything in place, or
        remove it and the agency forgets it immediately.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-5">
        <OrgCard profile={profile} onSaved={setProfile} />

        <div className="space-y-5 rounded-card border border-ink/8 bg-white p-5 shadow-card md:col-span-3">
          <h2 className="text-base font-bold text-ink">Learned by the agency</h2>
          {hasLearned ? (
            <>
              <Chips label="Priorities" field="priorities" values={learned.priorities} color="bg-plum-soft text-plum" onForget={forget} onEdit={edit} />
              <Chips label="Interests" field="interests" values={learned.interests} color="bg-gold-soft text-[#7a5500]" onForget={forget} onEdit={edit} />
              {learned.communicationStyle && (
                <Chips
                  label="Communication style"
                  field="communicationStyle"
                  values={[learned.communicationStyle]}
                  color="bg-sky/15 text-[#1d6ea3]"
                  onForget={forget}
                  onEdit={edit}
                />
              )}
              <Chips label="Notes" field="notes" values={learned.notes} color="bg-sage/20 text-[#3e6b51]" onForget={forget} onEdit={edit} />
            </>
          ) : (
            <p className="text-sm text-ink-soft">
              Nothing yet — the agency learns after each session you close.
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-lg font-bold text-ink">Session history</h2>
      <div className="mt-3 space-y-3">
        {sessions.length === 0 && <p className="text-sm text-ink-soft">No sessions yet.</p>}
        {sessions.map((s) => (
          <Link
            key={s.id}
            to={`/chat/${s.id}`}
            className="block rounded-card border border-ink/8 bg-white p-4 shadow-card transition-colors hover:border-plum/30"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {new Date(s.createdAt).toLocaleString()}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  s.status === "active" ? "bg-gold-soft text-[#7a5500]" : "bg-plum-soft text-plum"
                }`}
              >
                {s.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">
              {s.summary ?? "In progress — close the session to save what the agency learned."}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
