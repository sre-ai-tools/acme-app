"""Opaque keyset cursors over (started_at, id), newest first."""

import base64
import binascii
from datetime import datetime
from uuid import UUID

from .errors import ApiError


def encode_cursor(started_at: datetime, id: UUID) -> str:
    raw = f"{started_at.isoformat()}|{id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        started_at, id = raw.split("|")
        parsed = datetime.fromisoformat(started_at)
        if parsed.tzinfo is None:
            raise ValueError("naive datetime")
        return parsed, UUID(id)
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise ApiError(400, "invalid_cursor", "cursor is not valid") from None
