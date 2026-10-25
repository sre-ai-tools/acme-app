"""Migration rules a reviewer would otherwise have to catch by eye."""

import re
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[2] / "db" / "migrations"


def test_indexes_on_existing_tables_are_built_concurrently():
    # An index on a table created in an earlier migration must not block writes while it
    # builds: CONCURRENTLY, and outside a transaction (CONCURRENTLY can't run inside one).
    problems = []
    for migration in sorted(MIGRATIONS.glob("*.sql")):
        sql = re.sub(r"--[^\n]*", "", migration.read_text())
        created_here = set(re.findall(r"CREATE TABLE\s+(\w+)", sql, re.IGNORECASE))
        for stmt in re.finditer(
            r"CREATE\s+(UNIQUE\s+)?INDEX\b[^;]*?\bON\s+(\w+)", sql, re.IGNORECASE
        ):
            if stmt.group(2) in created_here:
                continue
            if "CONCURRENTLY" not in stmt.group(0).upper():
                problems.append(f"{migration.name}: index on {stmt.group(2)} not CONCURRENTLY")
            if re.search(r"\bBEGIN\b", sql, re.IGNORECASE):
                problems.append(f"{migration.name}: concurrent index inside a transaction")
    assert problems == []
