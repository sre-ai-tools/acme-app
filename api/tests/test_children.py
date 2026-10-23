"""Events, postmortems and action items."""

from uuid import uuid4


def test_events_sorted_by_occurred_at(client, incident):
    url = f"/incidents/{incident['id']}/events"
    for t, kind in [("14:30", "action"), ("14:00", "detection"), ("14:10", "communication")]:
        resp = client.post(
            url, json={"occurred_at": f"2026-10-01T{t}:00Z", "kind": kind, "body": kind}
        )
        assert resp.status_code == 201
    assert [e["kind"] for e in client.get(url).json()] == ["detection", "communication", "action"]


def test_events_missing_incident(client):
    url = f"/incidents/{uuid4()}/events"
    assert client.get(url).status_code == 404
    resp = client.post(
        url, json={"occurred_at": "2026-10-01T14:00:00Z", "kind": "note", "body": "x"}
    )
    assert resp.status_code == 404


def test_event_kind_validated(client, incident):
    resp = client.post(
        f"/incidents/{incident['id']}/events",
        json={"occurred_at": "2026-10-01T14:00:00Z", "kind": "tweet", "body": "x"},
    )
    assert resp.status_code == 422


def test_postmortem_upsert(client, incident):
    url = f"/incidents/{incident['id']}/postmortem"
    assert client.get(url).status_code == 404

    body = {"summary": "s", "impact": "i", "root_cause": "r"}
    first = client.put(url, json=body)
    assert first.status_code == 200
    second = client.put(url, json=body | {"summary": "s2"})
    assert second.json()["summary"] == "s2"
    assert second.json()["created_at"] == first.json()["created_at"]
    assert client.get(url).json()["summary"] == "s2"


def test_postmortem_missing_incident(client):
    resp = client.put(
        f"/incidents/{uuid4()}/postmortem", json={"summary": "s", "impact": "i", "root_cause": "r"}
    )
    assert resp.status_code == 404


def test_action_items(client, incident):
    url = f"/incidents/{incident['id']}/action-items"
    resp = client.post(
        url, json={"description": "Add alarm", "owner": "oncall", "due_date": "2026-11-01"}
    )
    assert resp.status_code == 201
    item = resp.json()
    assert item["done"] is False

    resp = client.patch(f"/action-items/{item['id']}", json={"done": True, "due_date": None})
    assert resp.status_code == 200
    assert resp.json()["done"] is True and resp.json()["due_date"] is None
    assert [i["id"] for i in client.get(url).json()] == [item["id"]]


def test_action_item_errors(client, incident):
    assert client.patch(f"/action-items/{uuid4()}", json={"done": True}).status_code == 404
    assert client.patch(f"/action-items/{uuid4()}", json={}).status_code == 422
    resp = client.post(
        f"/incidents/{incident['id']}/action-items", json={"description": "x", "owner": ""}
    )
    assert resp.status_code == 422
