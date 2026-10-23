from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends

from ..db import get_conn
from ..errors import not_found
from ..models import Postmortem, PostmortemIn

router = APIRouter(prefix="/incidents/{incident_id}/postmortem", tags=["postmortems"])

COLUMNS = "incident_id, summary, impact, root_cause, created_at, updated_at"


@router.get("", response_model=Postmortem)
def get_postmortem(incident_id: UUID, conn: psycopg.Connection = Depends(get_conn)):
    row = conn.execute(
        f"SELECT {COLUMNS} FROM postmortems WHERE incident_id = %s", (incident_id,)
    ).fetchone()
    if row is None:
        raise not_found("Postmortem")
    return row


@router.put("", response_model=Postmortem)
def put_postmortem(
    incident_id: UUID, body: PostmortemIn, conn: psycopg.Connection = Depends(get_conn)
):
    try:
        return conn.execute(
            f"""
            INSERT INTO postmortems (incident_id, summary, impact, root_cause)
            VALUES (%(incident_id)s, %(summary)s, %(impact)s, %(root_cause)s)
            ON CONFLICT (incident_id) DO UPDATE
              SET summary = EXCLUDED.summary,
                  impact = EXCLUDED.impact,
                  root_cause = EXCLUDED.root_cause
            RETURNING {COLUMNS}
            """,
            {"incident_id": incident_id, **body.model_dump()},
        ).fetchone()
    except psycopg.errors.ForeignKeyViolation:
        raise not_found("Incident") from None
