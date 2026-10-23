# Requirements: Incident Log

> Status: **Draft**, 2026-10-22. Derived from [intent.md](intent.md). These describe *what* the app and repo must do; *how* belongs in [design.md](design.md).
>
> **Must** means required for the article; **Should** means wanted, but the article can ship without it.

## App features

- **APP-1 Must.** A user can create, list, view and update incidents. An incident has a title, severity (SEV1–SEV4), status (open, mitigated, resolved), start time and optional resolve time.
- **APP-2 Must.** A user can add timeline events to an incident (detection, action, communication, note), shown in time order.
- **APP-3 Must.** A user can write one postmortem per incident: summary, impact, root cause.
- **APP-4 Must.** A user can add action items to an incident, each with a description, owner, due date and done flag.
- **APP-5 Must.** The incident list can be filtered by status and severity, and is paginated.
- **APP-6 Must.** Only signed-in users can use the API and UI.
- **APP-7 Should.** An incident has an on-call owner, and creating a SEV1 incident sends a notification. _(Delivered by the cross-cutting PR in [plan.md](plan.md).)_

## Code realism

- **REAL-1 Must.** Every layer reads like production code: input validation, error handling, constraints and least-privilege IAM, with no TODO stubs in reviewed paths. Otherwise the personas review placeholders instead of code.
- **REAL-2 Must.** Each layer includes the tests a team would normally write (API unit tests, UI component tests). They are not run in CI (see REPO-3).
- **REAL-3 Must.** Terraform is valid HCL that a reviewer could plan against a real account, but it is never applied.

## Review setup

- **REV-1 Must.** The review-personas workflow runs on every non-draft PR and posts one combined comment.
- **REV-2 Must.** The repo config enables the 4 built-in personas and the custom Security engineer persona.
- **REV-3 Must.** The CI model is the default Qwen3 32B.
- **REV-4 Must.** Every PR is also reviewed locally with `/prpanel:review` before it is opened, and the local result is kept for the article.
- **REV-5 Must.** The staged PR is labelled as staged in its title and description, and every planted flaw is listed in [plan.md](plan.md) so the article can compare what was planted with what was caught.
- **REV-6 Must.** Planted secrets live in ordinary source files, not in files on review-personas' sensitive-file deny list (`.env*`, `*secret*.y*ml`, `*credentials*.json`, keys), which are never sent to the model.
- **REV-7 Must.** Planted secrets are obviously fake and avoid formats that GitHub push protection blocks (e.g. `AKIA…` AWS keys).

## Repo

- **REPO-1 Must.** One directory per layer: `infra/`, `api/`, `ui/`, `db/`.
- **REPO-2 Must.** Each PR in [plan.md](plan.md) is a separate branch and PR against `main`, merged in order.
- **REPO-3 Must.** No build, test or deploy workflows. The only workflow is review-personas.
- **REPO-4 Must.** No real credentials, account IDs or ARNs in the repo, except the reviewer role ARN in the workflow file.
