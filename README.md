# JagoBridge

Internal LLM access control and an OpenAI-compatible AI gateway for the team.

JagoBridge syncs the model catalog from **9router**, lets admins grant models, features, and
rolling usage limits (5-hour and weekly) per person through packages (access profiles) and per-user
overrides, and exposes an OpenAI-compatible endpoint so members can call the models they are
allowed to use with their own API key. Every request is authenticated, checked against access
rules and limits, forwarded to 9router, and recorded.

Built to the specification in `1.PRD/PRD_JagoBridge.md` (v1.3).

---

## Architecture

```text
JagoBridge/
├── backend/                      # Node.js + Express + TypeScript (management API + gateway)
│   ├── src/
│   │   ├── api/v1/               # Management API (/api/v1/*)
│   │   ├── api/health.routes.ts  # GET /health (public)
│   │   ├── gateway/              # AI gateway (/v1/*): pipeline, upstream client, OpenAI errors
│   │   ├── middleware/           # request-id, auth, api-key, rate-limit, error handler
│   │   ├── core/                 # env (Zod), errors, logger (pino), security, constants
│   │   ├── db/                   # Knex instance, migrations, seeds
│   │   ├── repositories/         # Knex queries (no queries in routes)
│   │   ├── services/             # access, usage, rate-limit, sync, invitations, audit, ...
│   │   ├── schemas/              # Zod request/response schemas
│   │   ├── jobs/                 # model sync scheduler, retention
│   │   └── cli/                  # create-admin, sync-models, retention
│   └── tests/                    # unit, integration, load
├── frontend/                     # React + TypeScript + Vite + Tailwind console
│   └── src/
│       ├── app/                  # App, routes (role guards), providers
│       ├── pages/                # one folder per screen
│       ├── components/           # ui, layout, charts, features
│       ├── hooks/                # auth, toasts, TanStack Query resource hooks
│       ├── lib/                  # api-client, formatting, permissions
│       └── types/                # API types mirroring the backend contract
├── deploy/                       # docker-compose (Postgres + Redis), nginx, backup
├── docs/                         # API and architecture notes
└── .github/workflows/            # CI
```

**Key rules:** the management API and the gateway share one codebase and database but live in
separate route groups. Access, feature, and limit checks live in exactly one place —
`backend/src/gateway/pipeline.ts`. The upstream API key is read only in
`backend/src/gateway/upstream-client.ts` and is never logged or returned.

---

## Prerequisites

- Node.js 20+ (developed on Node 24)
- Docker (for PostgreSQL and Redis)

## Setup

### 1. Install dependencies

```bash
npm install
npm run install:all
```

### 2. Start PostgreSQL and Redis

```bash
npm run infra:up
```

This starts Postgres on **port 5440** and Redis on **port 6380** (chosen to avoid clashing with
other local services). Connection details live in `deploy/docker-compose.yml`.

### 3. Configure the backend

Copy the template and adjust as needed. The defaults in `backend/.env` already match the Docker
services:

```bash
cp backend/.env.example backend/.env
```

Set `UPSTREAM_API_KEY` to the team key for `https://9router.jagoai.dev/v1` to enable model sync.
`APP_SECRET_KEY` and `JWT_SECRET_KEY` must each be at least 32 characters.

### 4. Migrate and seed

```bash
npm run migrate:latest
npm run seed:run
```

Seeds the four default features (`streaming`, `tool_calling`, `vision_input`, `json_mode`), the
default package catalogue (Free, Starter, Basic, Pro, Business, Enterprise plus the internal
Admin profile) and default system settings. Packages live in `access_profiles` and carry a tier
label, a monthly price, quotas, a rate limit and an overage action.

### 5. Create the first admin

There is no UI path to create the first admin (PRD F-02):

```bash
npm --prefix backend run cli -- create-admin \
  --name "Administrator" --email "admin@jago.com" --password "Passw0rdJago"
```

Omit the flags to be prompted interactively. Passwords need at least 10 characters with an
uppercase letter, a lowercase letter, and a digit.

The bundled seed (`npm run seed:run`) creates `admin@jago.com` by default; override it with
`SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

### 6. Run the app

```bash
npm run dev
```

- Console: <http://localhost:3000>
- Backend API: <http://localhost:5000>
- Health check: <http://localhost:5000/health>

---

## Gateway usage

Point any OpenAI-compatible tool at the gateway and use a JagoBridge API key (create one in the
console under **API Keys**; it is shown once):

```bash
# List the models you can use
curl http://localhost:5000/v1/models -H "Authorization: Bearer jb_..."

# Chat completion
curl http://localhost:5000/v1/chat/completions \
  -H "Authorization: Bearer jb_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"team-coder","messages":[{"role":"user","content":"Hello"}]}'
```

Streaming, tool calling, vision input, and JSON mode are gated per user. Rejections use the
OpenAI error shape with an `error.code` (for example `USAGE_LIMIT_5H_EXCEEDED`) and a
`Retry-After` header when a window is exhausted.

---

## Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Run backend and frontend together |
| `npm run infra:up` / `infra:down` | Start / stop Postgres + Redis |
| `npm run migrate:latest` / `migrate:rollback` | Apply / roll back migrations |
| `npm run seed:run` | Seed features, profiles, settings |
| `npm run typecheck` | Typecheck backend and frontend |
| `npm test` | Run backend and frontend tests |
| `npm run build` | Build backend and frontend |
| `npm --prefix backend run cli -- <cmd>` | CLI: `create-admin`, `sync-models`, `retention` |

---

## Implementation status

Release 1 is a single production deployment after all P0 and P1 features are accepted
(PRD §2.3). Current state:

**Backend (P0 complete)**
- Migrations for all 18 tables, seeds, Docker infra
- Auth: login with lockout, rotating refresh tokens with reuse detection, change password,
  accept invitation
- Users, invitations, packages (access profiles), features, API keys, model catalog + 9router
  sync, model/feature overrides
- Gateway `/v1/models` and `/v1/chat/completions` with the full pipeline, SSE streaming, usage
  recording (including the upstream HTTP status returned by 9router), OpenAI-shaped errors, and
  usage/rate-limit headers
- Usage summary/stats/events + CSV export (team-wide for admins, own scope for members),
  settings, audit log, `/health`
- Unit tests for access rules and rolling-window math, plus end-to-end smoke verification

**Frontend (P0 screens)**
- Login, accept invitation, change password, usage notice
- Dashboard (live monitoring, gateway pipeline, KPI cards, service health, 24h traffic chart,
  status-code donut, endpoint monitoring, activity logs), Model catalog (provider-grouped,
  inline status toggles, aliases, token multipliers), Clients & Access (users + client detail,
  quota bars, row actions), API Packages (card grid with full CRUD), Features, Usage, API Keys,
  Audit Log, Settings

**Not yet built (P1/P2)**: chat playground (F-14), and the P2 backlog (2FA, limit-warning
emails, embeddings, forgot-password by email, shared quota pool). Lint/Prettier configs,
Playwright E2E, k6 load scripts, and CI workflow files are also still pending.
