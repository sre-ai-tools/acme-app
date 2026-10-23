# Intent: Incident Log

> Status: **Draft**, 2026-10-22. Awaiting owner approval.

## What

A small demo application, **Incident Log**, that SRE teams would use to record incidents, their timelines and their postmortems. It has four layers:

- **Infra:** Terraform for AWS
- **API:** a REST API
- **UI:** a web front end
- **SQL:** a Postgres schema with migrations

## Why

The app exists to demonstrate **[review-personas](https://github.com/sre-ai-tools/review-personas)** for a LinkedIn article. Each layer maps to one built-in persona, so the article can show the panel reviewing real-looking pull requests:

| Layer | Persona |
|---|---|
| Infra (Terraform) | ☁️ AWS architect |
| API | 🧑‍💻 App developer |
| UI | 🎨 UI developer |
| SQL | 🗄️ DBA |
| All layers | 🔐 Security engineer (custom persona) |

The point is the **review process**, not the app. The app only needs to be realistic enough that the reviews are meaningful.

## Who reads it

- **LinkedIn readers:** engineers and engineering leads deciding whether AI pre-review is worth trying.
- **The author:** builds the repo PR by PR and captures the review comments for the article.

## Decisions

| Decision | Choice |
|---|---|
| Deployment | **Never built or deployed.** No `terraform apply`, no build pipeline, no AWS spend for the app. |
| Compute | AWS Lambda behind API Gateway |
| Code hosting | GitHub (review-personas posts to GitHub PRs only) |
| Reviews | Local `/prpanel:review` in Claude Code before each PR, **and** the review-personas GitHub Action on every PR |
| CI model | Default: Qwen3 32B (`qwen.qwen3-32b-v1:0`) on Bedrock |
| Local model | The author's Claude Code model, so local and CI results will differ; the article says so |
| Personas | The 4 built-ins plus a custom **Security engineer** persona |
| Staged PR | One PR with deliberately planted flaws, one per persona, **labelled as staged** in the PR and in the article |
| AWS needed | Only for the reviewer: one IAM role (GitHub OIDC) allowed to call the Bedrock model. Defined in a separate `bootstrap/` Terraform stack, applied once; the app's Terraform is never applied. |
