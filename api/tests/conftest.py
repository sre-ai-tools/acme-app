"""Test fixtures. DB tests run against a real Postgres with the migrations from db/migrations.

    TEST_DATABASE_URL=postgresql://postgres:x@localhost:5432/incident_log_test pytest

Without TEST_DATABASE_URL, DB tests are skipped and only the unit tests run.
"""

import os
from pathlib import Path

import psycopg
import pytest
from psycopg.conninfo import conninfo_to_dict

MIGRATIONS = Path(__file__).resolve().parents[2] / "db" / "migrations"
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def database():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set")
    # The schema is dropped and rebuilt, so never point this at a real database.
    if not conninfo_to_dict(TEST_DATABASE_URL).get("dbname", "").endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a database ending in _test")

    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        for migration in sorted(MIGRATIONS.glob("*.sql")):
            conn.execute(migration.read_text())
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    yield TEST_DATABASE_URL


@pytest.fixture
def client(database):
    from fastapi.testclient import TestClient

    from app.auth import current_user
    from app.main import app

    with psycopg.connect(database, autocommit=True) as conn:
        conn.execute("TRUNCATE incidents CASCADE")
    app.dependency_overrides[current_user] = lambda: "test-user"
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def incident(client):
    resp = client.post(
        "/incidents",
        json={"title": "Checkout down", "severity": 1, "started_at": "2026-10-01T14:00:00Z"},
    )
    assert resp.status_code == 201
    return resp.json()
