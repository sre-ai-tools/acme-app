#!/usr/bin/env bash
# Run the CI persona review locally against Bedrock and print the comment. Nothing is posted.
#
#   ./scripts/review.sh                      # all personas
#   ./scripts/review.sh --personas dba,security
#
# Uses your local AWS credentials. The review-personas commit and region are read from the
# workflow file, so local runs use the same code as CI.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
workflow="$root/.github/workflows/review-personas.yml"

sha="$(sed -nE 's#^ *uses: sre-ai-tools/review-personas/\.github/workflows/review\.yml@([0-9a-f]{40}).*#\1#p' "$workflow")"
region="$(sed -nE 's#^ *aws-region: *([a-z0-9-]+).*#\1#p' "$workflow")"
if [[ -z "$sha" || -z "$region" ]]; then
  echo "Could not read the review-personas commit or aws-region from $workflow" >&2
  exit 1
fi

command -v uvx >/dev/null || { echo "Needs uv: brew install uv" >&2; exit 1; }

# The PR title if this branch has a PR, else the last commit subject.
title="$(gh pr view --json title --jq .title 2>/dev/null || git log -1 --format=%s)"

git -C "$root" fetch --quiet origin main

exec uvx --quiet --from "git+https://github.com/sre-ai-tools/review-personas@$sha" \
  review-personas ci \
  --repo-root "$root" \
  --base-ref origin/main \
  --region "$region" \
  --repo sre-ai-tools/acme-app \
  --title "$title" \
  --dry-run \
  "$@"
