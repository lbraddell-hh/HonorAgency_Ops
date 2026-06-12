import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storedProfileId, type Agent, type Profile } from "../lib/api";
import { Avatar } from "../components/Avatar";

export function Welcome() {
  const navigate = useNavigate();
  const [ceo, setCeo] = useState<Agent>();
  const [existing, setExisting] = useState<Profile>();
  const [form, setForm] = useState({ email: "", displayName: "", title: "", department: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listAgents().then((agents) => setCeo(agents.find((a) => a.slug === "ceo")));
    const id = storedProfileId.get();
    if (id) api.getProfile(id).then(setExisting).catch(() => storedProfileId.clear());
  }, []);

  const start = async (profile: Profile) => {
    setBusy(true);
    try {
      const { session } = await api.createSession(profile.id);
      navigate(`/chat/${session.id}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.includes("@") || !form.displayName.trim()) return;
    setBusy(true);
    try {
      const profile = await api.createProfile(form);
      storedProfileId.set(profile.id);
      await start(profile);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="w-full max-w-xl text-center">
        <div className="mb-5 flex justify-center">
          <Avatar avatar={ceo?.avatar} size="xl" speaking={busy} />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-plum">
          {ceo?.displayName ?? "Honor"} · {ceo?.role ?? "Agency CEO"}
        </p>
        <h1 className="mt-3 font-editorial text-4xl leading-tight text-ink sm:text-[44px]">
          I'm the front door to your digital agency.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink-soft">
          Source digital talent for a task, an hour, or forever. Tell me what you need — I'll make
          the intake, bring in the right specialist, and remember you next time.
        </p>

        {existing ? (
          <div className="mx-auto mt-8 w-full max-w-sm space-y-3">
            <button
              onClick={() => start(existing)}
              disabled={busy}
              className="w-full rounded-full bg-plum px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-plum-deep disabled:opacity-50"
            >
              {busy ? "Opening your session…" : `Continue as ${existing.displayName}`}
            </button>
            <button
              onClick={() => {
                storedProfileId.clear();
                setExisting(undefined);
              }}
              className="w-full text-sm font-medium text-ink-soft hover:text-plum"
            >
              Not you? Start fresh
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 w-full max-w-sm space-y-3 text-left">
            {(
              [
                ["displayName", "Full name", "Jordan Rivera", true],
                ["email", "Work email", "jordan.rivera@honorhealth.com", true],
                ["title", "Title", "Nurse Manager", false],
                ["department", "Department", "Emergency Services", false],
              ] as const
            ).map(([key, label, placeholder, required]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {label}
                  {required ? "" : " (optional)"}
                </span>
                <input
                  type={key === "email" ? "email" : "text"}
                  required={required}
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-card border border-ink/15 bg-white px-4 py-2.5 text-[15px] shadow-card outline-none placeholder:text-ink-soft/50 focus:border-plum/60"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-full bg-plum px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-plum-deep disabled:opacity-50"
            >
              {busy ? "Honor is preparing your welcome…" : "Meet the agency"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
