# Upstream Sync — 2026-06 (paperclipai/paperclip → HonorAgency_Ops)

Fork point: `0a2230b2e` (2026-06-08). Upstream delta: **64 commits**.
Integration branch: `upstream-sync/2026-06` (off `master`).
Cherry-pick order = upstream chronological (oldest → newest), top to bottom within this list.

Legend: `[x]` include · `[ ]` skip · ⚠ = touches one of the 12 overlap files / needs conflict care.

---

## A. Bugfixes & reliability — INCLUDE (the agreed floor)

- [x] `ce7b49e4f` Recover duplicate npm provenance canary publishes (#7839)
- [x] `a0f7d3dab` Reset task session on timer-driven wakes (PF-4) (#4838)
- [x] `47bd02647` commitperclip: stop security gate from hanging the review check (#7847)
- [x] `8ee3987d1` adapter-claude-local: recover from poisoned previous_message_id 400 (#5972)
- [x] `5d315ab77` Defer same-issue forceFreshSession wakes into follow-up runs (#4080)
- [x] `0713dfa41` Validate session ID as UUID before --resume + diagnostics (#1742)
- [x] `058381349` heartbeat: don't reuse runtime.sessionId across an adapter swap (#4109)
- [x] `dfd3ed44c` Auto-retry on Claude "Could not process image" 400 on resume (#3276)
- [x] `c297ba2a8` codex-local: replace stale auth.json copy with symlink (#5240)
- [x] `f3db7b88e` Clear stale checkoutRunId on run finalization + backstop sweeper (#6008)
- [x] `c32193c85` test(codex-local): EEXIST race rejection (#5269)
- [x] `b853ce518` Fix heartbeat task-session reuse when agent model changes (#4195)
- [x] `b8fb81dee` gemini-local: treat token-overflow as fresh-session signal (#4932)
- [x] `11a64819f` Keep agent-created follow-ups in run workspace
- [x] `93cdc5c1c` adapter-utils: tar sandbox workspace by entry to avoid EPERM (#7836)
- [x] `c139d6c02` codex-local: omit default model so CLI picks per auth mode (#7971)
- [x] `d2ef76771` heartbeat: clear orphan execution locks when a run finalizes (#4318)
- [x] `bb7978327` logger: redact passwords and tokens from HTTP error log lines (#8013)
- [x] `482f64e34` plugin-kubernetes: resolve sandbox pod by exact name (#7982)
- [x] `7058d7b6c` Auto-complete approved review comments (#5839)
- [x] `d7f2f8832` server: allow board members the null-mapped visibility actions (#7935)
- [x] `e1e2cef92` ⚠ issues: accept array-form ?status= filter, stop crashing (#4890) — `routes/issues.ts`
- [x] `130219c0b` recovery: exempt stranded escalation on recent visible progress (#5213)
- [x] `d782c4cd5` heartbeat: prevent zombie run coalescing; startup reap before timer (#1731)
- [x] `7945c7039` issues: reopen-guard for assignee self-comment on terminal issue (#4346)
- [x] `9e8106767` Clear stale executionRunId on release/reassignment/checkout (#2482)
- [x] `deef1f479` heartbeat: release execution lock on cross-agent reassignment (#5110)
- [x] `01e59c074` watchdog: suppress repeat alerts when source blocked/board-closed (#5942)
- [x] `d7049e0ca` server: adopt stale checkout run ownership (#5413)
- [x] `3b7c42be8` openclaw-gateway: complete and stabilize integration (#2322)
- [x] `fecc41d4f` recovery: skip stranded-issue recovery when pending wake exists (#4854)
- [x] `d9ea1bf9e` Skip same-run self-comments (heartbeat-reopen + implicit-todo) (#4973)
- [x] `3fbab2e6d` ⚠ Resolve orphan-sweep null-assignee filter regression (#8018)
- [x] `4965dc834` ⚠ ui: don't window-scroll the desktop shell on comment submit (#8041)
- [x] `a5b3cc98b` server: cache Intl.DateTimeFormat per timezone in cron stepper (#8034)
- [x] `c21f70ef1` Skip gosu when already running as target user (#2908)
- [x] `3701be76f` Read-only agent config/skill endpoints shouldn't need agents:create (#3725)
- [x] `4c26b984a` routines: detect variables when underscores are markdown-escaped (#8056)
- [x] `412a04c96` ⚠ ui: keep desktop shell pinned when scrollIntoView walks past body (#8071)

## B. Adapter gateway routing & wake semantics — INCLUDE (low-risk infra)

- [x] `1ac1ba544` opencode-local: env-driven gateway routing (#7837)
- [x] `6e4aca9c6` pi-local: env-driven gateway routing (#7920)
- [x] `9e750d3e9` codex-local: env-driven gateway routing (#7919)
- [x] `69a368ed5` gemini-local: pre-select gemini-api-key auth for headless runs (#7918)
- [x] `67b22d872` [codex] Clarify interrupt handoffs and scoped wake semantics (#7855)

## C. Model selectors — INCLUDE (low risk)

- [x] `393e6f5e6` Add Claude Fable 5 and Mythos 5 to the model selector (#7826)
- [x] `9a48d9210` Add GPT-5.5 to Codex local model options (#5575)

## D. Chosen feature groups — INCLUDE (per decision)

### Skills Store  → triggers migration renumber
- [x] `1413729a0` Build the Skills Store (#7990) — adds migrations 0099, 0100

### Multi-tenant security  → #5865 triggers migration renumber
- [x] `606e74d11` cloud_tenant: company-scoped tenants, never instance-admin (#7525)
- [x] `70357b961` per-company JWT signing keys for multi-tenant isolation (#5864)
- [x] `05bcd3ce8` ⚠ plugin tables get company_id FK for tenant isolation (#5865) — adds migration 0101, touches `_journal.json`

### Kubernetes sandbox provider (3 stages)
- [x] `05ab45225` plugin-kubernetes: self-hostable K8s sandbox provider — stage 1/3 (#5790)
- [x] `4ad94d0bd` server: kubernetes execution integration — stage 2/3 (#7938)
- [x] `398d74609` build(agent-runtime): harness runtime images — stage 3/3 (#7934)

## E. Medium UI / infra features — INCLUDE (confirmed)

- [x] `50bff3b27` ⚠ feat(ui): collapsible sidebar rail + takeover panes (#7824) — overlaps our `Sidebar.tsx`, resolve conflict
- [x] `bf62e3fbf` feat(ui): routine detail page — variation C sub-sidebar layout (#7848)
- [x] `468edd8b2` Add workspace file viewer and artifact links (#7681) — large (64 files)
- [x] `e3aada1df` feat(ui): add Feedback item to the account flyout menu (#7854)
- [x] `fae7e920a` [codex] Polish routine layout follow-ups (#7858)
- [x] `937fe62d1` feat(server): TRUST_PROXY supports CIDR list + named subnets (#5872)
- [x] `362c30ccd` feat(server): opt-in OpenTelemetry auto-instrumentation (#3735)
- [x] `8ddd735a7` feat(ui): theme toggle on unauthenticated auth page (#5874)
- [x] `cd1b4f275` feat(ui): default to system prefers-color-scheme for first visit (#5873)

## F. Excluded

- [ ] `6f9801a46` NUX rework / conference-room chat behind `enableConferenceRoomChat` (#8000) — overlaps our front-door chat app; defer.
- [ ] `05cb18cf2` docs(release): v2026.609.0 changelog (#7830) — upstream's own release notes; not relevant to our fork.

---

## Migration handling (required — Skills Store + #5865 selected)
Upstream keeps 0099–0101; our three renumber to **0102/0103/0104**:
`0099_document_file_mirroring → 0102`, `0100_front_door → 0103`, `0101_front_door_projects → 0104`.
Rebuild `meta/_journal.json` (upstream 0099–0101 first, ours 0102–0104 after) and rebuild local `honoragency_db`.
