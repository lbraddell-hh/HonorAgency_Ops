# HonorHealth Front Door

A standalone chat gateway where HonorHealth employees engage the digital
agency: the CEO agent (Sol) runs intake and welcome, delegates to specialists
with visible handoffs, learns each employee across sessions, and exposes the
same flows as REST + a real MCP server for Copilot agents.

Deliberately distinct from the Paperclip ops UI — this is purely the front door.

## Run

```sh
pnpm fd:seed     # seed the agent roster (idempotent)
pnpm fd:server   # Express API + MCP on http://localhost:4123
pnpm fd:web      # Vite web app on http://localhost:5273
```

Demo flows: intake → chat with Sol → ask for data/ops/comms help to see a
specialist handoff → "End session" → My profile shows what the agency learned →
the next session's welcome references it. The mic button is push-to-talk
(Web Speech API); the waveform toggle speaks replies in each agent's voice.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://localhost:5432/honoragency_db` | Postgres (fd_* tables) |
| `ANTHROPIC_API_KEY` | _unset_ | If set, the engine calls the Anthropic API directly (`claude-opus-4-8`). If unset, it runs on the local `claude` CLI subscription login via the Claude Agent SDK. |
| `FRONT_DOOR_MCP_API_KEY` | `hh-front-door-dev-key` | Bearer key for `/mcp` |
| `PAPERCLIP_API_URL` / `PAPERCLIP_API_KEY` / `PAPERCLIP_COMPANY_ID` | _unset_ | When set, `create_task` files real Paperclip issues; otherwise tasks are logged locally |
| `PORT` | `4123` | Server port |

## MCP (Copilot / other hosts)

Streamable HTTP endpoint at `http://localhost:4123/mcp`, stateless, bearer auth:

```jsonc
// Copilot Studio / VS Code mcp.json style
{
  "honorhealth-front-door": {
    "type": "http",
    "url": "http://localhost:4123/mcp",
    "headers": { "Authorization": "Bearer hh-front-door-dev-key" }
  }
}
```

Tools: `start_session`, `send_message`, `get_user_profile`, `list_agents`,
`get_session_transcript`.

## Design

- `design/DESIGN_PROMPT.md` — the master design prompt (brand, cast, screens)
- `design/avatars/` — Pixar-style (non-humanistic) avatar art direction,
  one spec per agent; the UI's geometric placeholders share the same skeleton
- Brand source: HonorHealth design system (Purple `#72226d`, Gold `#ffb81d`,
  Gotham/Utopia → Montserrat/Source Serif 4)
