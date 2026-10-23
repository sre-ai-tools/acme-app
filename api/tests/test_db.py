"""Connection handling for Lambda behind RDS Proxy."""

import psycopg

from app import db


def test_no_server_side_prepared_statements(client):
    for _ in range(10):
        assert client.get("/incidents").status_code == 200
    rows = db._conn.execute("SELECT count(*) AS n FROM pg_prepared_statements").fetchone()
    assert rows["n"] == 0


def test_recovers_from_dropped_connection_after_idle(client, database):
    assert client.get("/incidents").status_code == 200
    pid = db._conn.info.backend_pid
    with psycopg.connect(database, autocommit=True) as admin:
        admin.execute("SELECT pg_terminate_backend(%s)", (pid,))

    db._last_used = 0.0  # as if the environment had been frozen
    assert client.get("/incidents").status_code == 200
    assert db._conn.info.backend_pid != pid
