"""Search incidents by the text of their timeline events."""

import psycopg
from fastapi import APIRouter, Depends, Query

from ..db import get_conn
from ..errors import ApiError
from ..models import Incident
from .incidents import COLUMNS

router = APIRouter(tags=["search"])


class SearchResult(Incident):
    owner_handle: str | None  # None when the incident is unassigned


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/search", response_model=list[SearchResult])
def search(
    q: str = Query(min_length=3, max_length=200),
    limit: int = Query(20, ge=1, le=50),
    conn: psycopg.Connection = Depends(get_conn),
):
    # Length is checked after stripping: "   " would otherwise match every event with a space.
    q = q.strip()
    if len(q) < 3:
        raise ApiError(422, "validation_error", "q: at least 3 non-blank characters")
    columns = ", ".join(f"i.{c.strip()}" for c in COLUMNS.split(","))
    rows = conn.execute(
        f"""
        SELECT {columns} FROM incidents i
        WHERE EXISTS (
          SELECT 1 FROM incident_events e
          WHERE e.incident_id = i.id AND e.body ILIKE %(pattern)s
        )
        ORDER BY i.started_at DESC, i.id DESC
        LIMIT %(limit)s
        """,
        {"pattern": f"%{_escape_like(q)}%", "limit": limit},
    ).fetchall()

    return [
        SearchResult(
            **incident,
            owner_handle=incident["owner"].lower() if incident["owner"] else None,
        )
        for incident in rows
    ]
