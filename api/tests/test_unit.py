"""Unit tests: no database."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from app.auth import current_user
from app.errors import ApiError
from app.main import app
from app.models import ActionItemUpdate, IncidentCreate, IncidentUpdate
from app.pagination import decode_cursor, encode_cursor


def test_cursor_round_trip():
    started_at, id = datetime(2026, 10, 1, 14, 0, tzinfo=UTC), uuid4()
    assert decode_cursor(encode_cursor(started_at, id)) == (started_at, id)


@pytest.mark.parametrize("cursor", ["", "not-base64!", "Zm9v", encode_cursor.__name__])
def test_invalid_cursor(cursor):
    with pytest.raises(ApiError) as exc:
        decode_cursor(cursor)
    assert exc.value.status == 400


def test_naive_cursor_datetime_rejected():
    import base64

    raw = base64.urlsafe_b64encode(f"2026-10-01T14:00:00|{uuid4()}".encode()).decode()
    with pytest.raises(ApiError):
        decode_cursor(raw)


def _request(event: dict | None) -> Request:
    scope = {"type": "http", "headers": []}
    if event is not None:
        scope["aws.event"] = event
    return Request(scope)


def test_current_user_from_jwt_claims():
    event = {"requestContext": {"authorizer": {"jwt": {"claims": {"sub": "user-123"}}}}}
    assert current_user(_request(event)) == "user-123"


@pytest.mark.parametrize(
    "event", [None, {}, {"requestContext": {"authorizer": {"jwt": {"claims": {}}}}}]
)
def test_current_user_missing(event):
    with pytest.raises(ApiError) as exc:
        current_user(_request(event))
    assert exc.value.status == 401


def test_requests_without_claims_are_rejected():
    # No dependency override: this is what a request that bypassed the authorizer gets.
    resp = TestClient(app).get("/incidents")
    assert resp.status_code == 401
    assert resp.json() == {"error": {"code": "unauthorized", "message": "Missing caller identity"}}


def test_incident_create_requires_resolved_at_iff_resolved():
    base = {"title": "x", "severity": 2, "started_at": "2026-10-01T14:00:00Z"}
    with pytest.raises(ValidationError):
        IncidentCreate(**base, status="resolved")
    with pytest.raises(ValidationError):
        IncidentCreate(**base, resolved_at="2026-10-01T15:00:00Z")
    with pytest.raises(ValidationError):
        IncidentCreate(**base, status="resolved", resolved_at="2026-10-01T13:00:00Z")
    assert IncidentCreate(**base, status="resolved", resolved_at="2026-10-01T15:00:00Z")


def test_incident_create_rejects_naive_datetimes_and_unknown_fields():
    with pytest.raises(ValidationError):
        IncidentCreate(title="x", severity=2, started_at="2026-10-01T14:00:00")
    with pytest.raises(ValidationError):
        IncidentCreate(title="x", severity=2, started_at="2026-10-01T14:00:00Z", assignee="me")


def test_updates_reject_empty_and_nulls():
    with pytest.raises(ValidationError):
        IncidentUpdate()
    with pytest.raises(ValidationError):
        IncidentUpdate(title=None)
    with pytest.raises(ValidationError):
        IncidentUpdate(status="resolved")
    assert IncidentUpdate(severity=3).model_dump(exclude_unset=True) == {"severity": 3}
    assert ActionItemUpdate(due_date=None).model_dump(exclude_unset=True) == {"due_date": None}
    with pytest.raises(ValidationError):
        ActionItemUpdate(done=None)
