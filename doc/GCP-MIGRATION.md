# GCP Migration Plan — Database, Storage, Model APIs & Secrets

How to move a HonorAgency / Paperclip instance from **local development**
(Homebrew Postgres + local-disk storage + CLI-login models) to **Google Cloud**
(Cloud SQL + Google Cloud Storage + Vertex AI / API keys + Secret Manager) when
you're ready to leave local dev.

The system is designed so each subsystem is swapped by **configuration**, not code.
Everything below changes either `~/.paperclip/instances/<id>/config.json`,
`~/.paperclip/instances/<id>/.env`, or process environment variables — the
application reads the same interfaces regardless of backend.

> **Golden rule:** environment variables override `config.json`. For a cloud
> deploy, prefer setting env vars (injected by your platform / Secret Manager)
> over committing values to `config.json`.

---

## 0. Current local baseline (what we're replacing)

| Subsystem | Local dev today | Set by |
| --- | --- | --- |
| Database | Homebrew PostgreSQL 15 — `postgres://honoragency:…@localhost:5432/honoragency_db` | `DATABASE_URL` in instance `.env` / `config.database` |
| File storage | Local disk under `~/.paperclip/instances/default/data/storage` | `config.storage.provider = "local_disk"` |
| Documents | Postgres canonical + mirrored markdown files in storage (`…/documents/…`) | (automatic — see [§3](#3-storage--google-cloud-storage-gcs)) |
| Model APIs | Claude / Codex / Gemini via **subscription/CLI login** | per-agent adapter env / host CLI auth |
| Secrets | `local_encrypted` (master key file on disk) | `config.secrets.provider` |

Config schema of record: `packages/shared/src/config-schema.ts`.
Database resolution: `packages/db/src/runtime-config.ts`.
Storage provider selection: `server/src/storage/provider-registry.ts`.

---

## 1. Order of operations (recommended)

1. Provision GCP resources (Cloud SQL, GCS bucket, Secret Manager, Vertex AI / keys).
2. **Database** → Cloud SQL (data migration + connection string).
3. **Storage** → GCS (copy existing files + provider switch).
4. **Documents** → run the mirror reconcile/backfill against the new storage.
5. **Model APIs** → Vertex AI or API keys per agent adapter.
6. **Secrets** → Secret Manager (optional; can stay `local_encrypted` initially).
7. Verify, then cut over traffic. Keep the local instance as rollback until verified.

Do these one at a time and verify after each — they're independent.

---

## 2. Database → Cloud SQL for PostgreSQL

The DB layer is already cloud-portable; it just needs a connection string.
`resolveDatabaseTarget()` (in `packages/db/src/runtime-config.ts`) resolves, in order:
`process.env.DATABASE_URL` → instance `.env` `DATABASE_URL` →
`config.database.connectionString` (when `mode = "postgres"`) → embedded fallback.

### 2.1 Provision
- Create a **Cloud SQL for PostgreSQL 15** instance (match the local major version).
- Create database `honoragency_db` and a least-privilege login role.
- Choose a connection path:
  - **Cloud SQL Auth Proxy** (recommended): run the proxy as a sidecar; connect to
    `127.0.0.1:5432` over the proxy. Simplest TLS/IAM story.
  - **Private IP** (VPC): connect directly to the instance's private IP.
  - **Public IP + SSL**: allowed but least preferred.

### 2.2 Migrate the data
```bash
# Dump local (schema + data)
pg_dump "postgres://honoragency:honoragency@localhost:5432/honoragency_db" \
  --no-owner --no-privileges -Fc -f honoragency.dump

# Restore into Cloud SQL (via Auth Proxy on localhost:5432, or private IP host)
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgres://USER:PASS@CLOUDSQL_HOST:5432/honoragency_db" honoragency.dump
```
Alternatively use Cloud SQL's managed import from a `.sql`/`.dump` in GCS.

### 2.3 Point the app at Cloud SQL
Set **one** of:
- Env (preferred for cloud): `DATABASE_URL=postgres://USER:PASS@HOST:5432/honoragency_db`
- Or `config.database`:
  ```json
  "database": {
    "mode": "postgres",
    "connectionString": "postgres://USER:PASS@HOST:5432/honoragency_db"
  }
  ```

### 2.4 Apply migrations & verify
```bash
pnpm db:migrate          # applies any pending drizzle migrations to Cloud SQL
```
Boot the server and confirm the banner shows
`Mode: external-postgres` and the Cloud SQL host. No schema changes are needed for
the cutover — the migration that this branch added (`0099_document_file_mirroring`)
is part of the normal migration set.

> SSL: pass `?sslmode=require` (or `?sslmode=verify-full` with a CA) in the
> connection string if connecting without the Auth Proxy.

---

## 3. Storage → Google Cloud Storage (GCS)

Document mirror files and all attachments/assets flow through the
`StorageProvider` interface (`server/src/storage/types.ts`). Provider is chosen by
`server/src/storage/provider-registry.ts` from `config.storage.provider`
(`local_disk | s3 | gcs`). **Object keys are provider-agnostic** — the same paths
become GCS object names with no key changes:
```
{companyId}/documents/{issue|library}/{identifier}/current.md
{companyId}/documents/{issue|library}/{identifier}/revisions/{n}.md
{companyId}/issues/…              # attachments
{companyId}/assets/…              # company assets/logos
```

There are **two ways** to target GCS:

### Option A — S3-interop endpoint (zero new code; available today)
GCS exposes an S3-compatible API. The existing `s3` provider already accepts an
endpoint override, so this needs only config + HMAC credentials:
```bash
PAPERCLIP_STORAGE_PROVIDER=s3
PAPERCLIP_STORAGE_S3_BUCKET=honoragency-docs
PAPERCLIP_STORAGE_S3_REGION=us            # value required but ignored by GCS
PAPERCLIP_STORAGE_S3_ENDPOINT=https://storage.googleapis.com
PAPERCLIP_STORAGE_S3_FORCE_PATH_STYLE=true
# HMAC keys for a service account (Cloud Storage → Settings → Interoperability):
AWS_ACCESS_KEY_ID=GOOG1E...
AWS_SECRET_ACCESS_KEY=...
```
Trade-off: GCS S3-interop does not support AWS-style presigned URLs. We don't rely
on presigned URLs today (all reads stream through the server), so this is fine.

### Option B — Native GCS provider (later drop-in)
A `gcs` provider value and a `config.storage.gcs` placeholder are already reserved
(`packages/shared/src/constants.ts`, `config-schema.ts`). To implement:
1. Add `server/src/storage/gcs-provider.ts` implementing `StorageProvider`
   (`putObject/getObject/headObject/deleteObject`) using `@google-cloud/storage`.
2. Register it under `config.storageProvider === "gcs"` in
   `server/src/storage/provider-registry.ts` (today `gcs` falls through to the S3
   branch).
3. Config:
   ```json
   "storage": { "provider": "gcs", "gcs": { "bucket": "honoragency-docs", "prefix": "" } }
   ```
Use Workload Identity / ADC for auth (no static keys). Prefer this for production.

### 3.1 Migrate existing files
Copy the local storage tree into the bucket once:
```bash
gcloud storage cp -r \
  ~/.paperclip/instances/default/data/storage/* \
  gs://honoragency-docs/
```
(Or `gsutil -m rsync -r`.) Keys/paths are identical, so no transformation needed.

### 3.2 Reconcile the document mirrors
After switching the storage provider, run the idempotent backfill so every
document has a current mirror pointer in the new backend (safe to re-run; skips
already-current files via SHA-256):
```bash
pnpm documents:backfill-mirrors           # all companies
# or: ... src/scripts/backfill-document-mirrors.ts --company <companyId>
```

---

## 4. Documents (this branch) — what carries over for free

The documents feature was built to be storage-backend-agnostic, so migration is
covered by §2–§3:

- **Canonical data** lives in Postgres → moves with the Cloud SQL migration (§2).
- **Mirror files** live in the storage provider → move with the GCS switch (§3),
  then `documents:backfill-mirrors` reconciles pointers.
- **Flat metadata** (`documents.mirror_*` columns) maps 1:1 to **BigQuery** columns
  for the AI index. To feed BigQuery later, subscribe a plugin to the
  `document.created/updated/deleted/revision.discarded` events — their payloads
  already carry `scope`, `slug`, `revisionNumber`, `mirrorObjectKey`, `mirrorSha256`.
- No document code changes are required to migrate.

---

## 5. Model APIs → Vertex AI or API keys

Locally the agents authenticate via subscription/CLI login. In a headless cloud
deploy there is no interactive login, so configure **per-agent adapter env** (or
host env) with one of the options below. Each adapter passes its env through to
the underlying CLI, which supports these providers.

### 5.1 Anthropic (Claude) — `claude-local` adapter
- **API key:** `ANTHROPIC_API_KEY=sk-ant-…`
- **Vertex AI (GCP-native):** route Claude through Vertex AI Model Garden —
  ```bash
  CLAUDE_CODE_USE_VERTEX=1
  ANTHROPIC_VERTEX_PROJECT_ID=<gcp-project>
  CLOUD_ML_REGION=us-east5
  # auth via ADC / Workload Identity
  ```
- **AWS Bedrock** (if multi-cloud): `CLAUDE_CODE_USE_BEDROCK=1` +
  `ANTHROPIC_BEDROCK_BASE_URL` (the adapter already detects these in
  `packages/adapters/claude-local/src/server/test.ts`).

### 5.2 Google (Gemini) — `gemini-local` adapter
- **API key:** `GEMINI_API_KEY=…` (or `GOOGLE_API_KEY`).
- **Vertex AI (GCP-native):**
  ```bash
  GOOGLE_GENAI_USE_VERTEXAI=true
  GOOGLE_CLOUD_PROJECT=<gcp-project>
  GOOGLE_CLOUD_LOCATION=us-central1
  # auth via ADC / Workload Identity
  ```

### 5.3 OpenAI (Codex) — `codex-local` adapter
- OpenAI is not GCP-hosted; keep using an OpenAI key:
  `OPENAI_API_KEY=…` (the adapter writes it into the codex `auth.json`).
- For Azure OpenAI, point the CLI at the Azure base URL instead.

### 5.4 Where to set these
Set per agent in its **adapter environment** (Agent → settings → adapter env) so
each role can use a different provider/model, or as **host env** as a default for
all agents. Store the secret values in Secret Manager (§6) and inject them — do not
commit keys to `config.json` or `.env` in source control.

---

## 6. Secrets → Google Secret Manager (optional)

`gcp_secret_manager` is already a recognized provider
(`SECRET_PROVIDERS` in `packages/shared/src/constants.ts`) but ships as a stub
(`server/src/secrets/external-stub-providers.ts`). Two paths:

- **Stay on `local_encrypted`** initially — keep the master key file on a mounted
  secret/volume. Simplest; fine for a first cloud deploy.
- **Implement `gcp_secret_manager`** — model it on
  `server/src/secrets/aws-secrets-manager-provider.ts`, swap the AWS SDK for
  `@google-cloud/secret-manager`, implement the `SecretProviderModule` interface,
  and register it in `server/src/secrets/provider-registry.ts`. Then set
  `config.secrets.provider = "gcp_secret_manager"` (or `PAPERCLIP_SECRETS_PROVIDER`).

Regardless of provider, inject the platform-level env (DB password, model keys,
storage HMAC) from Secret Manager into the runtime — that's the highest-value win.

---

## 7. Example production config / env

`config.json` (non-secret structure; secrets come from env):
```json
{
  "$meta": { "version": 1, "updatedAt": "…", "source": "configure" },
  "database": { "mode": "postgres" },
  "logging": { "mode": "file" },
  "server": { "deploymentMode": "authenticated", "host": "0.0.0.0", "port": 3100 },
  "storage": { "provider": "gcs", "gcs": { "bucket": "honoragency-docs", "prefix": "" } },
  "secrets": { "provider": "local_encrypted" }
}
```

Runtime env (injected by the platform / Secret Manager):
```bash
DATABASE_URL=postgres://USER:PASS@CLOUDSQL_HOST:5432/honoragency_db?sslmode=require
PAPERCLIP_STORAGE_PROVIDER=gcs            # or s3 + endpoint for interop
BETTER_AUTH_SECRET=<random-32-bytes>
# model providers (per-agent preferred; host defaults shown):
ANTHROPIC_API_KEY=…        # or CLAUDE_CODE_USE_VERTEX=1 + ANTHROPIC_VERTEX_PROJECT_ID
GEMINI_API_KEY=…           # or GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT
OPENAI_API_KEY=…
PAPERCLIP_TELEMETRY_DISABLED=1
```

---

## 8. Cutover checklist

- [ ] Cloud SQL reachable; `pg_restore` complete; `pnpm db:migrate` clean.
- [ ] `DATABASE_URL` points at Cloud SQL; server banner shows `external-postgres` + new host.
- [ ] GCS bucket created; local storage tree copied (`gcloud storage cp -r`).
- [ ] `PAPERCLIP_STORAGE_PROVIDER` switched; a test upload + document save lands in the bucket.
- [ ] `pnpm documents:backfill-mirrors` reports `0 failed`; spot-check a `current.md` in GCS.
- [ ] Each agent's adapter env has a working model provider (run a CEO task end-to-end).
- [ ] Secrets injected from Secret Manager (no plaintext keys in config/repo).
- [ ] Local instance retained until the above are verified (rollback path).

## 9. Rollback

Because the switch is config-only, rollback is symmetric: repoint `DATABASE_URL`
back to local Postgres and `PAPERCLIP_STORAGE_PROVIDER=local_disk`. The local data
and files remain intact until you decommission them. Keep the local instance until
the cloud instance has run cleanly for a representative period.

---

## References (code of record)

- Config schema: `packages/shared/src/config-schema.ts`
- DB resolution: `packages/db/src/runtime-config.ts`, `packages/db/src/client.ts`
- Storage interface & providers: `server/src/storage/{types,provider-registry,service,local-disk-provider,s3-provider}.ts`
- Document mirroring: `server/src/storage/document-mirror.ts`, `server/src/routes/documents.ts`
- Mirror backfill: `server/src/scripts/backfill-document-mirrors.ts` (`pnpm documents:backfill-mirrors`)
- Secrets providers: `server/src/secrets/*`, `SECRET_PROVIDERS` in `packages/shared/src/constants.ts`
- Model adapters: `packages/adapters/{claude-local,gemini-local,codex-local}/`
