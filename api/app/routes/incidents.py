from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Query, status
from psycopg import sql

from ..db import get_conn
from ..errors import not_found
from ..models import Incident, IncidentCreate, IncidentPage, IncidentUpdate, Status
from ..notify import notify_sev1
from ..pagination import decode_cursor, encode_cursor
from . import update_row

router = APIRouter(prefix="/incidents", tags=["incidents"])

COLUMNS = "id, title, severity, status, started_at, resolved_at, owner, created_at, updated_at"


@router.get("", response_model=IncidentPage)
def list_incidents(
    status_: Status | None = Query(None, alias="status"),
    severity: int | None = Query(None, ge=1, le=4),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    conn: psycopg.Connection = Depends(get_conn),
):
    where, params = [], {"limit": limit + 1}
    if status_:
        where.append(sql.SQL("status = %(status)s"))
        params["status"] = status_
    if severity:
        where.append(sql.SQL("severity = %(severity)s"))
        params["severity"] = severity
    if cursor:
        params["c_started_at"], params["c_id"] = decode_cursor(cursor)
        where.append(sql.SQL("(started_at, id) < (%(c_started_at)s, %(c_id)s)"))

    query = sql.SQL(
        "SELECT {} FROM incidents {} ORDER BY started_at DESC, id DESC LIMIT %(limit)s"
    ).format(
        sql.SQL(COLUMNS),
        sql.SQL("WHERE ") + sql.SQL(" AND ").join(where) if where else sql.SQL(""),
    )
    rows = conn.execute(query, params).fetchall()

    # One extra row tells us whether there is a next page.
    next_cursor = None
    if len(rows) > limit:
        rows = rows[:limit]
        next_cursor = encode_cursor(rows[-1]["started_at"], rows[-1]["id"])
    return IncidentPage(items=rows, next_cursor=next_cursor)


@router.post("", response_model=Incident, status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreate, conn: psycopg.Connection = Depends(get_conn)):
    row = conn.execute(
        f"""
        INSERT INTO incidents (title, severity, status, started_at, resolved_at, owner)
        VALUES (%(title)s, %(severity)s, %(status)s, %(started_at)s, %(resolved_at)s, %(owner)s)
        RETURNING {COLUMNS}
        """,
        body.model_dump(),
    ).fetchone()
    # After the insert has committed (autocommit), so a page never points at a missing row.
    if row["severity"] == 1:
        notify_sev1(row)
    return row


@router.get("/{incident_id}", response_model=Incident)
def get_incident(incident_id: UUID, conn: psycopg.Connection = Depends(get_conn)):
    row = conn.execute(f"SELECT {COLUMNS} FROM incidents WHERE id = %s", (incident_id,)).fetchone()
    if row is None:
        raise not_found("Incident")
    return row


@router.patch("/{incident_id}", response_model=Incident)
def update_incident(
    incident_id: UUID, body: IncidentUpdate, conn: psycopg.Connection = Depends(get_conn)
):
    changes = body.model_dump(exclude_unset=True)
    # Reopening or mitigating clears the resolve time, which the table requires.
    if changes.get("status") in ("open", "mitigated"):
        changes.setdefault("resolved_at", None)

    # Lock the row to read its severity before the update, so two concurrent escalations
    # to SEV1 send one notification, not two.
    with conn.transaction():
        before = conn.execute(
            "SELECT severity FROM incidents WHERE id = %s FOR UPDATE", (incident_id,)
        ).fetchone()
        if before is None:
            raise not_found("Incident")
        row = update_row(conn, "incidents", "id", incident_id, changes, COLUMNS)

    if row["severity"] == 1 and before["severity"] != 1:
        notify_sev1(row)
    return row
