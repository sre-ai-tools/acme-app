"""Request and response models. Field limits mirror the CHECK constraints in db/migrations."""

from datetime import date, datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

Status = Literal["open", "mitigated", "resolved"]
EventKind = Literal["detection", "action", "communication", "note"]
Severity = Annotated[int, Field(ge=1, le=4, description="1 = SEV1 (worst) .. 4 = SEV4")]
# Trimmed, not blank, no control characters (it appears in SEV1 pages). Matches the CHECK in 005.
Owner = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=200, pattern=r"^[^\x00-\x1f\x7f]*$"
    ),
]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _reject_nulls(model: BaseModel, nullable: set[str]) -> None:
    for name in model.model_fields_set - nullable:
        if getattr(model, name) is None:
            raise ValueError(f"{name} cannot be null")


# Incidents


class IncidentCreate(RequestModel):
    title: str = Field(min_length=1, max_length=200)
    severity: Severity
    status: Status = "open"
    started_at: AwareDatetime
    resolved_at: AwareDatetime | None = None
    owner: Owner | None = None

    @model_validator(mode="after")
    def check_resolution(self) -> Self:
        if (self.status == "resolved") != (self.resolved_at is not None):
            raise ValueError("resolved_at is required when, and only when, status is resolved")
        if self.resolved_at and self.resolved_at < self.started_at:
            raise ValueError("resolved_at must not be before started_at")
        return self


class IncidentUpdate(RequestModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    severity: Severity | None = None
    status: Status | None = None
    started_at: AwareDatetime | None = None
    resolved_at: AwareDatetime | None = None
    owner: Owner | None = None

    @model_validator(mode="after")
    def check_fields(self) -> Self:
        # null resolved_at reopens; null owner unassigns.
        _reject_nulls(self, nullable={"resolved_at", "owner"})
        if not self.model_fields_set:
            raise ValueError("no fields to update")
        if self.status == "resolved" and self.resolved_at is None:
            raise ValueError("resolved_at is required when status is resolved")
        if self.status in ("open", "mitigated") and self.resolved_at is not None:
            raise ValueError("resolved_at must be empty unless status is resolved")
        return self


class Incident(BaseModel):
    id: UUID
    title: str
    severity: int
    status: Status
    started_at: datetime
    resolved_at: datetime | None
    owner: str | None
    created_at: datetime
    updated_at: datetime


class IncidentPage(BaseModel):
    items: list[Incident]
    next_cursor: str | None


# Timeline events


class EventCreate(RequestModel):
    occurred_at: AwareDatetime
    kind: EventKind
    body: str = Field(min_length=1, max_length=10000)


class Event(BaseModel):
    id: UUID
    incident_id: UUID
    occurred_at: datetime
    kind: EventKind
    body: str
    created_at: datetime


# Postmortems


class PostmortemIn(RequestModel):
    summary: str = Field(min_length=1, max_length=20000)
    impact: str = Field(min_length=1, max_length=20000)
    root_cause: str = Field(min_length=1, max_length=20000)


class Postmortem(PostmortemIn):
    model_config = ConfigDict(extra="ignore")

    incident_id: UUID
    created_at: datetime
    updated_at: datetime


# Action items


class ActionItemCreate(RequestModel):
    description: str = Field(min_length=1, max_length=2000)
    owner: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    done: bool = False


class ActionItemUpdate(RequestModel):
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    owner: str | None = Field(default=None, min_length=1, max_length=200)
    due_date: date | None = None
    done: bool | None = None

    @model_validator(mode="after")
    def check_fields(self) -> Self:
        _reject_nulls(self, nullable={"due_date"})
        if not self.model_fields_set:
            raise ValueError("no fields to update")
        return self


class ActionItem(BaseModel):
    id: UUID
    incident_id: UUID
    description: str
    owner: str
    due_date: date | None
    done: bool
    created_at: datetime
    updated_at: datetime
