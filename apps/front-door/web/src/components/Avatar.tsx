import type { AgentAvatar } from "../lib/api";

/* Placeholder avatar system: a branded squircle with one signature geometric
   motif per agent. The Pixar-style character art (see design/avatars/) will
   replace the motif layer later; the squircle, color, and speaking-ring
   treatment carry over unchanged. */

const SIZES = { sm: 32, md: 44, lg: 72, xl: 112 } as const;

function Motif({ motif, accent }: { motif: string; accent: string }) {
  switch (motif) {
    case "beacon": // Honor — a rising sun/beacon arc
      return (
        <g>
          <circle cx="50" cy="58" r="16" fill={accent} />
          <g stroke={accent} strokeWidth="5" strokeLinecap="round">
            <line x1="50" y1="30" x2="50" y2="20" />
            <line x1="29" y1="39" x2="22" y2="32" />
            <line x1="71" y1="39" x2="78" y2="32" />
          </g>
        </g>
      );
    case "bars": // Mara — ascending bars
      return (
        <g fill="#ffffff">
          <rect x="28" y="52" width="11" height="22" rx="4" />
          <rect x="45" y="40" width="11" height="34" rx="4" />
          <rect x="62" y="28" width="11" height="46" rx="4" />
        </g>
      );
    case "orbit": // Otto — connected nodes
      return (
        <g>
          <circle cx="50" cy="50" r="22" fill="none" stroke="#ffffff" strokeWidth="4" />
          <circle cx="50" cy="28" r="7" fill={accent} />
          <circle cx="31" cy="61" r="7" fill="#ffffff" />
          <circle cx="69" cy="61" r="7" fill="#ffffff" />
        </g>
      );
    case "rings": // Remy — voice rings
      return (
        <g fill="none" strokeLinecap="round">
          <circle cx="42" cy="50" r="8" fill="#ffffff" stroke="none" />
          <path d="M58 36 a20 20 0 0 1 0 28" stroke="#ffffff" strokeWidth="5" />
          <path d="M68 28 a32 32 0 0 1 0 44" stroke="#ffffff" strokeWidth="5" opacity="0.7" />
        </g>
      );
    default:
      return null;
  }
}

export function Avatar({
  avatar,
  size = "md",
  speaking = false,
}: {
  avatar: AgentAvatar | null | undefined;
  size?: keyof typeof SIZES;
  speaking?: boolean;
}) {
  const px = SIZES[size];
  const primary = avatar?.primaryColor ?? "#72226d";
  const accent = avatar?.accentColor ?? "#ffb81d";
  return (
    <div
      className={`shrink-0 ${speaking ? "speaking-ring" : ""}`}
      style={{ width: px, height: px }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={px} height={px}>
        <rect x="2" y="2" width="96" height="96" rx="34" fill={primary} />
        {avatar?.motif ? (
          <Motif motif={avatar.motif} accent={accent} />
        ) : (
          <text x="50" y="62" textAnchor="middle" fontSize="38" fontWeight="700" fill="#ffffff">
            {avatar?.initials ?? "?"}
          </text>
        )}
      </svg>
    </div>
  );
}

export function UserDot({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
      {name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </div>
  );
}
