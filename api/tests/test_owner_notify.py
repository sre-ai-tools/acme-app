"""On-call owner and SEV1 notifications (APP-7)."""

import logging
from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app import notify
from app.routes import incidents as incidents_route

START = "2026-10-01T14:00:00Z"


@pytest.fixture
def pages(monkeypatch):
    sent = []
    monkeypatch.setattr(incidents_route, "notify_sev1", lambda row: sent.append(str(row["id"])))
    return sent


def create(client, severity, **extra):
    resp = client.post(
        "/incidents", json={"title": "t", "severity": severity, "started_at": START, **extra}
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_owner_round_trip_and_unassign(client):
    incident = create(client, 3, owner="alice-oncall")
    assert incident["owner"] == "alice-oncall"

    resp = client.patch(f"/incidents/{incident['id']}", json={"owner": None})
    assert resp.status_code == 200 and resp.json()["owner"] is None
    assert (
        client.post(
            "/incidents", json={"title": "t", "severity": 3, "started_at": START, "owner": ""}
        ).status_code
        == 422
    )


def test_new_sev1_pages_and_others_do_not(client, pages):
    sev1 = create(client, 1)
    create(client, 2)
    assert pages == [sev1["id"]]


def test_escalation_to_sev1_pages_once(client, pages):
    incident = create(client, 3)
    url = f"/incidents/{incident['id']}"

    assert client.patch(url, json={"severity": 1}).status_code == 200
    assert client.patch(url, json={"title": "renamed"}).status_code == 200  # still SEV1
    assert client.patch(url, json={"severity": 1}).status_code == 200  # no change
    assert pages == [incident["id"]]


def test_patch_missing_incident_does_not_page(client, pages):
    assert client.patch(f"/incidents/{uuid4()}", json={"severity": 1}).status_code == 404
    assert pages == []


# notify_sev1 itself, without a database.

INCIDENT = {
    "id": uuid4(),
    "title": "Checkout down — eu-west-1",  # non-ASCII is fine in the message body
    "status": "open",
    "owner": None,
    "started_at": datetime(2026, 10, 1, 14, 0, tzinfo=UTC),
}


class FakeSns:
    def __init__(self, fail=False):
        self.fail, self.calls = fail, []

    def publish(self, **kwargs):
        if self.fail:
            raise RuntimeError("SNS unavailable")
        self.calls.append(kwargs)


def test_notify_publishes_to_the_topic(monkeypatch):
    sns = FakeSns()
    monkeypatch.setattr(notify, "_sns", lambda: sns)
    monkeypatch.setenv("NOTIFY_TOPIC_ARN", "arn:aws:sns:us-east-1:000000000000:sev1")

    notify.notify_sev1(INCIDENT)

    [call] = sns.calls
    assert call["TopicArn"].endswith(":sev1")
    assert call["Subject"] == "SEV1 incident"
    assert "Owner: unassigned" in call["Message"] and str(INCIDENT["id"]) in call["Message"]


def test_notify_failure_is_logged_not_raised(monkeypatch, caplog):
    monkeypatch.setattr(notify, "_sns", lambda: FakeSns(fail=True))
    monkeypatch.setenv("NOTIFY_TOPIC_ARN", "arn:aws:sns:us-east-1:000000000000:sev1")

    with caplog.at_level(logging.ERROR):
        notify.notify_sev1(INCIDENT)
    assert notify.FAILURE_MESSAGE in caplog.text


def test_notify_without_topic_does_nothing(monkeypatch):
    sns = FakeSns()
    monkeypatch.setattr(notify, "_sns", lambda: sns)
    monkeypatch.delenv("NOTIFY_TOPIC_ARN", raising=False)
    notify.notify_sev1(INCIDENT)
    assert sns.calls == []


def test_owner_is_trimmed_and_blank_or_control_chars_rejected(client):
    assert create(client, 3, owner="  bob-oncall ")["owner"] == "bob-oncall"
    for bad in ["   ", "bob\nIncident: forged"]:
        resp = client.post(
            "/incidents", json={"title": "t", "severity": 3, "started_at": START, "owner": bad}
        )
        assert resp.status_code == 422, bad


def test_deescalate_then_escalate_pages_again(client, pages):
    # Intentional: a second escalation to SEV1 is a new page.
    incident = create(client, 1)
    url = f"/incidents/{incident['id']}"
    assert client.patch(url, json={"severity": 2}).status_code == 200
    assert client.patch(url, json={"severity": 1}).status_code == 200
    assert pages == [incident["id"], incident["id"]]


def test_notify_keeps_free_text_on_one_line(monkeypatch):
    sns = FakeSns()
    monkeypatch.setattr(notify, "_sns", lambda: sns)
    monkeypatch.setenv("NOTIFY_TOPIC_ARN", "arn:aws:sns:us-east-1:000000000000:sev1")

    notify.notify_sev1(INCIDENT | {"title": "DB down\nIncident: 00000000-forged\r\x07"})

    lines = sns.calls[0]["Message"].splitlines()
    assert lines[0] == "SEV1: DB down Incident: 00000000-forged"
    assert [line for line in lines if line.startswith("Incident:")] == [
        f"Incident: {INCIDENT['id']}"
    ]


def test_notify_strips_unicode_line_breaks(monkeypatch):
    sns = FakeSns()
    monkeypatch.setattr(notify, "_sns", lambda: sns)
    monkeypatch.setenv("NOTIFY_TOPIC_ARN", "arn:aws:sns:us-east-1:000000000000:sev1")
    notify.notify_sev1(INCIDENT | {"title": "a Incident: x b\x85c"})
    assert sns.calls[0]["Message"].splitlines()[0] == "SEV1: a Incident: x b c"
