# Plan: PRs and article

> Status: **Draft**, 2026-10-22. Implements [design.md](design.md).

## Prerequisites (by hand, once)

1. Push this repo to GitHub.
2. In AWS: enable Qwen3 32B in Bedrock for the chosen region, then `terraform apply` in `bootstrap/` to create the reviewer role, and set its `role_arn` output as the `REVIEWER_ROLE_ARN` repo variable (`gh variable set`). Add a CloudWatch alarm on Bedrock spend.
3. In Claude Code: `/plugin marketplace add sre-ai-tools/review-personas`, then `/plugin install prpanel@review-personas`.

## PR sequence

Each PR: build on a branch → `/prpanel:review` locally → save the output → fix or keep findings → open PR → save the CI comment → merge.

| PR | Branch | Contents | Expect relevant |
|---|---|---|---|
| 0 | `chore/review-panel` | Workflow, config, Security persona (D6) and the `bootstrap/` reviewer role. The panel reviews its own setup. | AWS architect, Security |
| 1 | `feat/db-schema` | `db/migrations/001–004`, seed data (D2) | DBA; UI "not relevant" |
| 2 | `feat/api` | FastAPI app, routes, tests (D3) | App developer, Security, DBA (queries) |
| 3 | `feat/infra` | Terraform (D5) | AWS architect, Security |
| 4 | `feat/ui` | React app, tests (D4) | UI developer; DBA "not relevant" |
| 5 | `feat/oncall-owner` | Cross-cutting: `owner` column + migration, API field + SEV1 publish to SNS, Terraform SNS topic + IAM, UI owner field and badge [APP-7] | All five |
| 6 | `staged/incident-search` | **Staged.** Incident search, with the flaws below. Title prefixed `[STAGED DEMO]`. | All five |

## Staged PR: planted flaws [REV-5]

| Persona | File (planned) | Planted flaw | Expected finding |
|---|---|---|---|
| 🗄️ DBA | `db/migrations/006_search_index.sql` | `CREATE INDEX` (trigram GIN on `incident_events.body`) without `CONCURRENTLY`, inside a transaction | Use `CREATE INDEX CONCURRENTLY` outside a transaction |
| ☁️ AWS architect | `infra/api.tf` | Lambda role gains `"Action": "*", "Resource": "*"` | Scope the policy to the needed actions and resources |
| 🧑‍💻 App developer | `api/app/routes/search.py` | `incident["owner"].lower()` where `owner` is nullable | Handle a null owner |
| 🎨 UI developer | `ui/src/components/SearchBar.tsx` | Icon-only search button with no accessible name | Add `aria-label` or visible text |
| 🔐 Security | `api/app/routes/search.py` | Hardcoded token `PAGER_TOKEN = "demo-not-a-real-token-0000"` in ordinary code [REV-6, REV-7] | Move it to Secrets Manager |

After the PR's reviews are captured, it is closed **without merging**.

## Evidence to capture

For every PR: the local `/prpanel:review` output, the CI comment (screenshot + Markdown), and the job summary's token counts. Optionally run `review-personas metrics`, but with one author the numbers are a demo, not evidence.

## Article outline

1. **Hook:** PRs wait in review queues; what if each arrived with a specialist pre-review?
2. **The panel:** what review-personas does; advisory score; "not relevant".
3. **The demo app:** Incident Log, four layers, one persona per layer; never deployed.
4. **Walkthrough:** PRs 1–5 with their comments; where personas agreed, disagreed or said "not relevant".
5. **The staged PR:** planted vs caught, in a table. Said plainly: this one was staged.
6. **Local vs CI:** same PR, Claude Code locally vs Qwen3 32B in CI; how results differed.
7. **Your own reviewer:** the Security persona is one Markdown file.
8. **Cost:** tokens per PR from the job summaries.
9. **Limits:** advisory only, models miss things, humans still review.
10. **Try it:** install steps and link.
