"""Database connection: one per Lambda execution environment, reused across warm starts.

Lambda sends one request at a time to an execution environment, so a single connection is
safe here. RDS Proxy pools connections across environments.
"""

import json
import os
from collections.abc import Iterator

import psycopg
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row

_conn: psycopg.Connection | None = None


def _conninfo() -> str:
    # Local runs and tests use DATABASE_URL. In Lambda, credentials come from Secrets Manager
    # and the host is the RDS Proxy endpoint.
    if url := os.environ.get("DATABASE_URL"):
        return url

    import boto3

    secret = json.loads(
        boto3.client("secretsmanager").get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])[
            "SecretString"
        ]
    )
    return make_conninfo(
        host=os.environ["DB_HOST"],
        port=secret.get("port", 5432),
        dbname=os.environ.get("DB_NAME", "incident_log"),
        user=secret["username"],
        password=secret["password"],
        sslmode="require",
        connect_timeout=5,
    )


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency. Autocommit; multi-statement work opens conn.transaction()."""
    global _conn
    if _conn is None or _conn.closed or _conn.broken:
        _conn = psycopg.connect(_conninfo(), autocommit=True, row_factory=dict_row)
    yield _conn
