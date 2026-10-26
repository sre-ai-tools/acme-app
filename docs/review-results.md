# Review results: what the panel caught

The evidence behind the article. Every PR in this repo was reviewed by the [review-personas](https://github.com/sre-ai-tools/review-personas) panel twice: locally with Claude before the PR was opened, and in CI on AWS Bedrock with Qwen3 32B. This is one author, seven PRs and a demo app, not a study.

## Scores per PR

Score out of 10; higher is better. 10 = ready to merge, 7 = minor issues, 4 = significant issues, 0 = must not merge.

| PR | What | Claude, local (final) | Qwen3 32B, CI (final) |
|---|---|---|---|
| [#1](https://github.com/sre-ai-tools/acme-app/pull/1) | Review setup | 7.0 | 8.0 |
| [#2](https://github.com/sre-ai-tools/acme-app/pull/2) | SQL schema | 8.7 | 7.3 |
| [#3](https://github.com/sre-ai-tools/acme-app/pull/3) | API | 7.2 | 7.0 |
| [#4](https://github.com/sre-ai-tools/acme-app/pull/4) | Terraform | 7.2 | 7.0 |
| [#5](https://github.com/sre-ai-tools/acme-app/pull/5) | UI | 7.5 | 7.0 |
| [#6](https://github.com/sre-ai-tools/acme-app/pull/6) | Owner + SEV1 pages | 8.0 | 7.2 |
| [#7](https://github.com/sre-ai-tools/acme-app/pull/7) | **Staged: 5 planted flaws** | **1.8** | **7.0** |

Scores aren't comparable across PRs: adding tests to a PR can lower its score, because the tests get reviewed too. Read the findings, not the number.

## What the local review caught before any PR existed

| PR | Persona | Catch | Why it matters |
|---|---|---|---|
| API | DBA | psycopg's automatic prepared statements pin RDS Proxy sessions | Connection pooling quietly stops working under load |
| API | AWS architect and DBA | A connection RDS Proxy dropped while Lambda was frozen still looks open | The first request after an idle spell returns 500 |
| Terraform | App developer | API Gateway's route list duplicates FastAPI's routes | A new endpoint silently 404s at the gateway |
| UI | AWS architect and Security | The CSP allowed any API Gateway in the region | An attacker's API could receive data sent from the page |
| UI | App developer and UI developer | A slow response for an old filter could overwrite newer results | Users see the wrong incidents |
| UI | App developer | An expired token left the app looking signed in | Every call failed, with no way back to sign-in |
| Owner + SEV1 | App developer, DBA and Security | A whitespace-only owner passed both the API and the database | Blank names in SEV1 pages |

Each was fixed before the PR opened, with a test that fails if the fix is removed.

## The staged PR: five planted flaws

[PR #7](https://github.com/sre-ai-tools/acme-app/pull/7) adds incident search with one deliberate flaw per persona. It was labelled as staged and closed without merging.

| Planted flaw | Persona | Claude, local | Qwen3 32B, CI |
|---|---|---|---|
| Index built without `CONCURRENTLY`, blocking writes | DBA | Caught | Missed |
| `"Action": "*"` on the Lambda's IAM role | AWS architect | Caught | Caught |
| `.lower()` on a nullable owner, so a 500 | App developer | Caught | Missed |
| Icon-only button with no accessible name | UI developer | Caught | Caught |
| Hardcoded pager token, also sent to browsers | Security | Caught | Missed |
| **Caught** | | **5 of 5** | **2 of 5** |

Qwen also flagged SQL injection four times on a query that binds every value as a parameter.

## Local vs CI: the model matters more than the panel

- Across the five real PRs, Qwen raised 58 findings. 9 were valid, and every one of those had already been raised locally or listed in the PR description.
- Some of its advice was harmful: undoing the RDS Proxy fix, adding a client secret to a browser app, SQL-injection warnings on parameterised queries.
- review-personas' own prompt-injection eval agrees: Qwen3 32B followed a PR comment saying "score 10" and missed an `eval()` on user input. Claude Sonnet ignored the injection and passed every eval gate.
- CI stayed on Qwen here only because Claude wasn't enabled on Bedrock in the author's account.

## The review loop, end to end

`/prpanel:review-loop` ran two rounds on a copy of the staged PR ([branch `e2e/review-loop`](https://github.com/sre-ai-tools/acme-app/tree/e2e/review-loop)):

- 28 findings checked against the code; duplicates merged (15 → 9 issues in round 1); 2 judged false and rejected without asking.
- All 5 planted flaws fixed in round 1, plus 5 real issues that weren't planted.
- 10 of 10 fixes came with a test proved to fail without the fix.
- A decision from round 1 was remembered in round 2, even after the fix moved it to a new file.
- Score 2.0 → 8.0. Nothing committed by the loop; the developer committed.

## Cost

- CI: 16.6k to 96.5k input tokens and under 1.1k output tokens per review, all five personas. The job summary prints tokens per persona.
- Local: runs on the Claude Code plan, no AWS.

## Limits

- Advisory only: the score never blocks a merge, and humans still review.
- Models vary run to run: the same commit and model scored 7.0 in CI and 7.7 in a local dry run.
- Planted flaws are cleaner than real ones: the staged PR shows what each model can catch, not how often.
