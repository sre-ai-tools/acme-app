"""Database connection: one per Lambda execution environment, reused across warm starts.

Lambda sends one request at a time to an execution environment, so a single connection is
safe here. RDS Proxy pools connections across environments.
"""

import json
import os
import time
from collections.abc import Iterator

import psycopg
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row

# A frozen Lambda environment can wake up to a connection the proxy has already dropped,
# which still looks open. After this much idle time, check it before use.
IDLE_CHECK_SECONDS = 30

_conn: psycopg.Connection | None = None
_last_used = 0.0


def _conninfo() -> str:
    # Local runs and tests use DATABASE_URL. In Lambda, credentials come from Secrets Manager
    # and the host is the RDS Proxy endpoint.
    if url := os.environ.get("DATABASE_URL"):
        return url

    import boto3
    from botocore.config import Config

    # Fail fast: API Gateway gives up after 29 seconds, botocore's defaults wait longer.
    client = boto3.client(
        "secretsmanager",
        config=Config(
            connect_timeout=2, read_timeout=3, retries={"max_attempts": 2, "mode": "standard"}
        ),
    )
    secret = json.loads(
        client.get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])["SecretString"]
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


def _connect() -> psycopg.Connection:
    return psycopg.connect(
        _conninfo(),
        autocommit=True,
        row_factory=dict_row,
        # Server-side prepared statements pin RDS Proxy sessions, which defeats pooling.
        prepare_threshold=None,
    )


def _alive(conn: psycopg.Connection) -> bool:
    try:
        conn.execute("SELECT 1")
        return True
    except psycopg.OperationalError:
        return False


def get_conn() -> Iterator[psycopg.Connection]:
    """FastAPI dependency. Autocommit; multi-statement work opens conn.transaction()."""
    global _conn, _last_used
    idle = time.monotonic() - _last_used > IDLE_CHECK_SECONDS
    if _conn is None or _conn.closed or _conn.broken or (idle and not _alive(_conn)):
        if _conn is not None:
            _conn.close()
        _conn = _connect()
    try:
        yield _conn
    finally:
        _last_used = time.monotonic()
