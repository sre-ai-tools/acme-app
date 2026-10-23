from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Query, status

from ..db import get_conn
from ..errors import not_found
from ..models import Event, EventCreate

router = APIRouter(prefix="/incidents/{incident_id}/events", tags=["events"])

COLUMNS = "id, incident_id, occurred_at, kind, body, created_at"


@router.get("", response_model=list[Event])
def list_events(
    incident_id: UUID,
    limit: int = Query(500, ge=1, le=1000),
    conn: psycopg.Connection = Depends(get_conn),
):
    if conn.execute("SELECT 1 FROM incidents WHERE id = %s", (incident_id,)).fetchone() is None:
        raise not_found("Incident")
    return conn.execute(
        f"""
        SELECT {COLUMNS} FROM incident_events
        WHERE incident_id = %s
        ORDER BY occurred_at, id
        LIMIT %s
        """,
        (incident_id, limit),
    ).fetchall()


@router.post("", response_model=Event, status_code=status.HTTP_201_CREATED)
def create_event(
    incident_id: UUID, body: EventCreate, conn: psycopg.Connection = Depends(get_conn)
):
    try:
        return conn.execute(
            f"""
            INSERT INTO incident_events (incident_id, occurred_at, kind, body)
            VALUES (%(incident_id)s, %(occurred_at)s, %(kind)s, %(body)s)
            RETURNING {COLUMNS}
            """,
            {"incident_id": incident_id, **body.model_dump()},
        ).fetchone()
    except psycopg.errors.ForeignKeyViolation:
        raise not_found("Incident") from None
