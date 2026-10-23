from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Query, status

from ..db import get_conn
from ..errors import not_found
from ..models import ActionItem, ActionItemCreate, ActionItemUpdate
from . import update_row

router = APIRouter(tags=["action-items"])

COLUMNS = "id, incident_id, description, owner, due_date, done, created_at, updated_at"


@router.get("/incidents/{incident_id}/action-items", response_model=list[ActionItem])
def list_action_items(
    incident_id: UUID,
    limit: int = Query(500, ge=1, le=1000),
    conn: psycopg.Connection = Depends(get_conn),
):
    if conn.execute("SELECT 1 FROM incidents WHERE id = %s", (incident_id,)).fetchone() is None:
        raise not_found("Incident")
    return conn.execute(
        f"""
        SELECT {COLUMNS} FROM action_items
        WHERE incident_id = %s
        ORDER BY created_at, id
        LIMIT %s
        """,
        (incident_id, limit),
    ).fetchall()


@router.post(
    "/incidents/{incident_id}/action-items",
    response_model=ActionItem,
    status_code=status.HTTP_201_CREATED,
)
def create_action_item(
    incident_id: UUID, body: ActionItemCreate, conn: psycopg.Connection = Depends(get_conn)
):
    try:
        return conn.execute(
            f"""
            INSERT INTO action_items (incident_id, description, owner, due_date, done)
            VALUES (%(incident_id)s, %(description)s, %(owner)s, %(due_date)s, %(done)s)
            RETURNING {COLUMNS}
            """,
            {"incident_id": incident_id, **body.model_dump()},
        ).fetchone()
    except psycopg.errors.ForeignKeyViolation:
        raise not_found("Incident") from None


@router.patch("/action-items/{item_id}", response_model=ActionItem)
def update_action_item(
    item_id: UUID, body: ActionItemUpdate, conn: psycopg.Connection = Depends(get_conn)
):
    row = update_row(
        conn, "action_items", "id", item_id, body.model_dump(exclude_unset=True), COLUMNS
    )
    if row is None:
        raise not_found("Action item")
    return row
