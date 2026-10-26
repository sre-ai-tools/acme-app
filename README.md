# acme-app: Incident Log

A demo app built to show [review-personas](https://github.com/sre-ai-tools/review-personas): a panel of AI reviewers (AWS architect, App developer, UI developer, DBA, Security) that reviews every pull request. The app is never deployed.

## What's in the repo

- `db/`: Postgres migrations, seed data and schema tests
- `api/`: FastAPI on AWS Lambda
- `ui/`: React + Vite + TypeScript
- `infra/`: Terraform for AWS (planned, never applied)
- `bootstrap/`: the IAM role the CI review uses
- `docs/specs/`: what was built and why

## Review your branch before opening a PR

You need [Claude Code](https://claude.com/claude-code) and [uv](https://docs.astral.sh/uv/) (`brew install uv`).

- Install the plugin once, in Claude Code:
  - `/plugin marketplace add sre-ai-tools/review-personas#v1.1.0`
  - `/plugin install prpanel@review-personas`
  - `#v1.1.0` pins the release; without it you get whatever is on `main`.
- Review your branch: `/prpanel:review`
- Or review, fix and review again: `/prpanel:review-loop`
  - It asks you which findings to fix, adds a test for each fix, and never commits.
- Without Claude Code: `./scripts/review.sh` (uses your Claude login)

## Review on every PR (CI)

- Already set up in `.github/workflows/review-personas.yml`.
- Each PR gets one comment with a score out of 10. Higher is better; it never blocks a merge.
- To set it up in your own fork:
  - Apply `bootstrap/` once (`terraform apply`) to create the reviewer's IAM role.
  - Save the role ARN as the repo variable `REVIEWER_ROLE_ARN`.
  - Enable the review model in Amazon Bedrock.

## Run the tests

- API (needs Docker):
  - `docker run -d --rm --name pg -e POSTGRES_PASSWORD=x -e POSTGRES_DB=incident_log_test -p 127.0.0.1:54329:5432 postgres:16-alpine`
  - `cd api && uv venv && uv pip install -e ".[dev]"`
  - `TEST_DATABASE_URL=postgresql://postgres:x@127.0.0.1:54329/incident_log_test .venv/bin/pytest`
- UI: `cd ui && npm install && npx vitest run`

## See it in action

- [Review results](docs/review-results.md): scores, what each review caught, Claude vs Qwen, the review loop.
- [Merged PRs](https://github.com/sre-ai-tools/acme-app/pulls?q=is%3Apr+is%3Amerged): each has the panel's review comment.
- [The staged PR](https://github.com/sre-ai-tools/acme-app/pull/7): five planted flaws, and what the reviews caught.
