# Design Prompt: HonorHealth Front Door — Agency Chat Gateway

> The master prompt for designing (or re-designing) the HonorHealth Front Door.
> Paste this into any design-capable Claude session, Figma Make, or hand it to a
> designer. The reference implementation lives in `apps/front-door/`.

## What you are building

A clean, beautiful chat surface — browser app and mobile app — where HonorHealth
employees engage a digital agency of AI agents. This is the agency's **front
door**: a deliberately simple gateway, visually distinct from the agency's
internal ops tooling. Employees come here to **source digital talent — for a
task, an hour, or forever.**

**The CEO is the only agent reachable through this app.** The CEO makes the
initial intake and welcome; everything else is delegated from there: the CEO
brings in the right specialist with a visible handoff, and takes the
conversation back when the specialist is done. Specialists never appear outside
a CEO handoff. Every session and task is associated with the user, so the
agency learns each person and opens the next session already knowing them.

## Brand

- **Primary**: HonorHealth Purple `#72226d` — CTAs, links, active states
- **Accent**: Gold `#ffb81d` — highlights and the CEO's signature color; never
  full backgrounds
- **Ink**: `#333333` body text; pure black only for high-contrast moments
- **Surfaces**: White cards on warm cream `#faf7f2`; subtle shadows; 10–12px radius
- **Extended accents** (one per specialist): sky `#4aa8e0`, sage `#7fa98f`,
  coral `#e0705f`
- **Type**: Gotham (web fallback: Montserrat) for UI and headings; Utopia
  (fallback: Source Serif 4) for editorial/welcome moments
- **Feel**: clinical credibility, calm, structured; minimize friction; every
  screen guides a clear next step. Avoid full-purple backgrounds. WCAG AA.
- Logo: approved HonorHealth assets only; clear spacing; no recoloring.

## The cast

Agents are characters with Pixar/Disney-style warmth — **non-humanistic**
mascots (no realistic faces). Each has a unique identity, voice, color, and
personality matched to the audience it serves. Until character art ships, use
the placeholder system: a squircle in the agent's color carrying one signature
geometric motif (see `design/avatars/` for the full art direction).

| Agent | Role | Motif | Color | Personality |
|---|---|---|---|---|
| **Sol** (CEO — most important) | Agency CEO & Chief Navigator | Beacon / rising sun | Purple + gold | Warm, unhurried, quietly confident; owns every relationship |
| Mara | Data & Insights Analyst | Ascending bars | Sky blue | Precise, curious, fast; always lands the "so what" |
| Otto | Operations Coordinator | Orbiting nodes | Sage green | Calm, methodical, reliable; never drops a task |
| Remy | Communications Specialist | Voice rings | Coral | Upbeat, empathetic, sharp with language |

## The job req lifecycle (the product's core loop)

A **job req** is the unit of work the agency takes on. The CEO drives it:

1. **Define** — once the reason the employee is contacting the agency is clear,
   the CEO opens a job req (status `draft`); a "Job req opened" card appears in
   the thread.
2. **Scope** — the CEO asks clarifying questions (quick-reply chips) until
   deliverables, timeline, and success criteria are locked (status `scoped`).
3. **Resource** — the CEO assigns roster specialists to responsibilities, each
   a tracked task (status `resourced`), then tells the employee who is on it.

Job reqs belong to their creator but are **shareable with colleagues** (members
see them in their own Job reqs list, marked "shared with you"). Sessions and
job reqs are **many-to-many**: one conversation can open or touch several reqs,
and a req accumulates sessions over time.

**File sharing**: employees attach files and images from the composer
(paperclip button). Images render as media bubbles, other files as file cards —
and the agents can actually read shared files when reasoning about the work.

## Screens (5 — each in desktop 1440 and mobile 390 variants)

1. **Welcome / Intake** (`/`) — CEO hero with avatar, serif welcome headline
   ("I'm the front door to your digital agency."), minimal form (name, email,
   title, department). Returning users get "Continue as …" instead of the form.
2. **Chat** (`/chat/:id`) — familiar thread layout. Agent messages carry avatar
   + name label; user messages right-aligned in purple. When the CEO brings in
   a specialist, render a **handoff card** (both avatars, "Sol is bringing in
   Remy, Communications Specialist — reason…"); hand-backs mirror it. Delegated
   work shows a gold **task chip** with the tracker reference. When an agent
   asks a question with a small set of natural answers, render **quick-reply
   chips** (2–4 tappable pill buttons, right-aligned above the composer) with a
   "or type your own reply below" hint — tapping sends that answer; the
   composer always stays available for free text. **Job req milestone cards**
   (purple left-rail card: "Job req opened / scoped / resourced" + title +
   detail) mark the lifecycle inside the thread. **Shared files** render as
   image bubbles or file cards on the user side. Sticky header shows the
   *active* agent and an "End session" action. Composer: voice-replies toggle,
   attach (paperclip), text input, push-to-talk mic, send.
3. **Voice mode** — a mode within chat: push-to-talk mic, animated speaking
   ring on the active agent's avatar, replies spoken in the agent's voice
   profile (rate/pitch per agent).
4. **Job reqs** (`/projects`) — "Work the agency is on": expandable cards per
   req with status badge (gold draft / sky scoped / sage resourced / plum
   closed), objective, deliverables, timeline, success criteria, the resourced
   team (specialist avatars + responsibilities), members + share-by-email, and
   links to every session that touched the req.
5. **My profile** (`/me`) — "What the agency knows about me", in two halves:
   - **My details** (user-owned): name, title, department, reports-to — fully
     editable by the user via an Edit → form → Save flow; the agency reads
     these at the start of every session.
   - **Learned by the agency**: priorities / interests / communication style /
     notes as colored chips — every chip **editable in place (✎)** and
     **removable (✕)**: visible, correctable, forgettable.
   Session history with status badges and two-sentence summaries.

There is **no agent directory** — the roster exists behind the CEO, never as a
user-facing surface.

## System behavior (design for it, even where simulated)

- **Persistent memory**: closing a session runs a learning loop that updates
  the employee profile; the next session's CEO welcome references it.
- **Deliberate scalability**: most needs are met by existing agents + user
  context. New agents are added deliberately, not spun up ad hoc.
- **Open by design**: the same flows are exposed as REST APIs and an MCP server
  (Streamable HTTP at `/mcp`) so the agency can be reached from Microsoft
  Copilot or embedded in other applications.
- Tone: navigator, not chatbot. Confirm intent. Always offer a next step.
  Plain conversational text — replies may be spoken aloud.

## Layout rules

- Desktop: centered column (max ~48rem for chat, ~64rem for directory/profile),
  sticky cream header with logo + nav pills.
- Mobile (<640px): single column, bottom-fixed composer, directory grid → list.
- Cards: white, 12px radius, soft branded shadow
  (`0 1px 3px rgba(51,51,51,.07), 0 4px 14px rgba(114,34,109,.06)`).
- Buttons: purple pill primary, outlined purple secondary, gold reserved for
  status/badges.
