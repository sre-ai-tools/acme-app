"""No IAM statement in infra/ grants every action. Least privilege is checked here because
the Terraform is never applied, so nothing else would catch a wildcard."""

import re
from pathlib import Path

INFRA = Path(__file__).resolve().parents[2] / "infra"


def test_no_iam_statement_grants_every_action():
    wildcard = re.compile(r'actions\s*=\s*\[\s*"\*"\s*\]')
    offenders = [
        f"{tf.name}:{n}"
        for tf in sorted(INFRA.glob("*.tf"))
        for n, line in enumerate(tf.read_text().splitlines(), 1)
        if wildcard.search(line)
    ]
    assert offenders == []
