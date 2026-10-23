# Design: Incident Log

> Status: **Draft**, 2026-10-22. Implements [requirements.md](requirements.md). Requirement IDs appear in brackets, e.g. [APP-1].

## Decisions

| # | Topic | Choice |
|---|---|---|
| D1 | Architecture | API Gateway HTTP API → Lambda (Python) → RDS Proxy → RDS Postgres; UI on S3 + CloudFront; Cognito for sign-in |
| D2 | SQL | Postgres 16, plain numbered SQL migrations, no ORM |
| D3 | API | Python 3.12, FastAPI on Lambda via Mangum, psycopg 3 with hand-written SQL |
| D4 | UI | React 18 + Vite + TypeScript, React Router, Vitest + Testing Library |
| D5 | Infra | Terraform ≥ 1.9, AWS provider 5.x, one root module split by concern |
| D6 | Review setup | review-personas workflow + config + custom Security persona |

---

## D1. Architecture

```
 Browser ──▶ CloudFront ──▶ S3 (UI static files)
    │
    │  JWT (Cognito)
    ▼
 API Gateway (HTTP API, JWT authorizer)
    │
    ▼
 Lambda: FastAPI ── private subnets ──▶ RDS Proxy ──▶ RDS Postgres (private subnets)
    │
    └──▶ Secrets Manager (DB credentials, via VPC endpoint)
```

- Lambda and RDS run in private subnets with no NAT gateway; Lambda reaches Secrets Manager through an interface VPC endpoint.
- RDS Proxy pools connections so Lambda concurrency doesn't exhaust Postgres.
- Cognito user pool + hosted UI handles sign-in [APP-6]; API Gateway's JWT authorizer rejects unauthenticated calls before Lambda runs.

**Why Lambda.** It's a demo that will never be deployed. Lambda keeps the Terraform small while still giving the AWS architect persona real topics: VPC placement, IAM scope, connection pooling, timeouts.

## D2. SQL layer

Files: `db/migrations/NNN_description.sql`, applied in order. Each file is forward-only and wrapped in a transaction unless it needs `CONCURRENTLY`.

```sql
incidents
  id            uuid        PK default gen_random_uuid()
  title         text        NOT NULL, CHECK length 1..200
  severity      smallint    NOT NULL, CHECK 1..4          -- SEV1..SEV4
  status        text        NOT NULL, CHECK IN ('open','mitigated','resolved')
  started_at    timestamptz NOT NULL
  resolved_at   timestamptz NULL, CHECK resolved_at >= started_at
  created_at    timestamptz NOT NULL default now()
  updated_at    timestamptz NOT NULL default now()
  CHECK (status = 'resolved') = (resolved_at IS NOT NULL)
  INDEX (started_at DESC, id DESC)                       -- APP-5 keyset pagination
  INDEX (status, started_at DESC, id DESC)               -- APP-5 status filter

incident_events
  id            uuid        PK
  incident_id   uuid        NOT NULL FK → incidents ON DELETE CASCADE
  occurred_at   timestamptz NOT NULL
  kind          text        NOT NULL, CHECK IN ('detection','action','communication','note')
  body          text        NOT NULL
  created_at    timestamptz NOT NULL default now()
  INDEX (incident_id, occurred_at)

postmortems                                               -- one per incident
  incident_id   uuid        PK, FK → incidents ON DELETE CASCADE
  summary       text        NOT NULL
  impact        text        NOT NULL
  root_cause    text        NOT NULL
  updated_at    timestamptz NOT NULL default now()

action_items
  id            uuid        PK
  incident_id   uuid        NOT NULL FK → incidents ON DELETE CASCADE
  description   text        NOT NULL
  owner         text        NOT NULL
  due_date      date        NULL
  done          boolean     NOT NULL default false
  INDEX (incident_id)
```

Seed data: `db/seed/dev_seed.sql` with a handful of incidents for screenshots.

## D3. API layer

Layout: `api/app/{main.py, db.py, models.py, routes/*.py}`, `api/tests/`, `api/pyproject.toml`.

| Method | Path | Notes |
|---|---|---|
| GET | `/incidents?status=&severity=&limit=&cursor=` | Keyset pagination on `(started_at, id)`, `limit` ≤ 100 [APP-5] |
| POST | `/incidents` | 201 + body |
| GET | `/incidents/{id}` | 404 if missing |
| PATCH | `/incidents/{id}` | Partial update; setting `resolved` requires `resolved_at` |
| GET / POST | `/incidents/{id}/events` | Events sorted by `occurred_at` [APP-2] |
| GET / PUT | `/incidents/{id}/postmortem` | PUT upserts [APP-3] |
| GET / POST | `/incidents/{id}/action-items` | [APP-4] |
| PATCH | `/action-items/{id}` | Toggle `done`, edit fields |

- Pydantic models validate every request; errors use one JSON shape: `{"error": {"code", "message"}}`.
- All SQL is parameterised. One connection per invocation, reused across warm starts.
- Caller identity comes from the JWT claims API Gateway passes through; the API never parses tokens itself.

## D4. UI layer

Layout: `ui/src/{pages,components,api}/`, `ui/package.json`, `ui/vite.config.ts`.

- Pages: incident list (filters + pagination), incident detail (timeline, postmortem, action items), new/edit incident form.
- A typed API client in `ui/src/api/` that mirrors D3.
- Accessibility basics: labelled form controls, keyboard-reachable actions, visible focus, severity shown as text as well as colour.
- Sign-in via Cognito hosted UI redirect; token kept in memory, not `localStorage`.

## D5. Infra layer

Layout under `infra/`:

| File | Contents |
|---|---|
| `versions.tf`, `providers.tf` | Terraform and provider pins; S3 backend block with placeholder values |
| `variables.tf`, `outputs.tf` | Region, environment name, CIDR, etc. |
| `network.tf` | VPC, 2 private subnets, security groups, Secrets Manager VPC endpoint |
| `database.tf` | RDS Postgres (encrypted, private, backups on), RDS Proxy, Secrets Manager secret |
| `api.tf` | Lambda function + least-privilege role, HTTP API, JWT authorizer, routes, log groups |
| `auth.tf` | Cognito user pool, app client, hosted UI domain |
| `frontend.tf` | S3 bucket (private, OAC) + CloudFront distribution |

The Lambda package path points at a zip that is never built; that is acceptable because nothing is applied [REAL-3].

The **reviewer's IAM role is not in this Terraform.** It must exist before the first PR is reviewed, and this Terraform is never applied. It lives in a separate stack, `bootstrap/`, that the author applies once with local state: one role trusted only by this repo's `pull_request` runs, allowed only `bedrock:InvokeModel` on the CI model. The account's existing GitHub OIDC provider is looked up, not created.

## D6. Review setup

| File | Purpose |
|---|---|
| `.github/workflows/review-personas.yml` | From review-personas `examples/caller-workflow.yml`, pinned to release `v1.0.0`; role ARN from the `REVIEWER_ROLE_ARN` repo variable, job skipped when unset |
| `.github/review-personas.yml` | Config: all built-ins enabled, extra focus per persona (e.g. DBA: "Postgres 16, migrations run against a live table"), no model override |
| `.github/review-personas/personas/security.md` | Custom **Security engineer** persona, from review-personas `examples/security.md` |

Local runs: install the `prpanel` plugin in Claude Code and run `/prpanel:review` on each branch before opening its PR.
