from uuid import uuid4


def test_create_and_get(client, incident):
    assert incident["status"] == "open" and incident["resolved_at"] is None
    resp = client.get(f"/incidents/{incident['id']}")
    assert resp.status_code == 200
    assert resp.json() == incident


def test_get_missing(client):
    resp = client.get(f"/incidents/{uuid4()}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_create_validation_error_shape(client):
    resp = client.post("/incidents", json={"title": "", "severity": 9, "started_at": "nope"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_patch_resolve_and_reopen(client, incident):
    url = f"/incidents/{incident['id']}"
    resp = client.patch(url, json={"status": "resolved"})
    assert resp.status_code == 422

    resp = client.patch(url, json={"status": "resolved", "resolved_at": "2026-10-01T15:00:00Z"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert resp.json()["updated_at"] > incident["updated_at"]

    resp = client.patch(url, json={"status": "open"})
    assert resp.status_code == 200
    assert resp.json()["resolved_at"] is None


def test_patch_db_constraint_maps_to_422(client, incident):
    # resolved_at alone, on an open incident, passes the model but violates the table check.
    resp = client.patch(
        f"/incidents/{incident['id']}", json={"resolved_at": "2026-10-01T15:00:00Z"}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "constraint_violation"


def test_patch_missing(client):
    resp = client.patch(f"/incidents/{uuid4()}", json={"severity": 2})
    assert resp.status_code == 404


def _create(client, title, severity, started_at, status="open"):
    body = {"title": title, "severity": severity, "started_at": started_at, "status": status}
    if status == "resolved":
        body["resolved_at"] = started_at
    assert client.post("/incidents", json=body).status_code == 201


def test_list_filters_and_keyset_pagination(client):
    for day in range(1, 8):
        _create(
            client,
            f"i{day}",
            1 + day % 4,
            f"2026-10-0{day}T00:00:00Z",
            "resolved" if day % 2 else "open",
        )

    seen, cursor = [], None
    while True:
        params = {"limit": 3} | ({"cursor": cursor} if cursor else {})
        page = client.get("/incidents", params=params).json()
        seen += [i["title"] for i in page["items"]]
        if not (cursor := page["next_cursor"]):
            break
    assert seen == [f"i{d}" for d in range(7, 0, -1)]

    open_titles = [
        i["title"] for i in client.get("/incidents", params={"status": "open"}).json()["items"]
    ]
    assert open_titles == ["i6", "i4", "i2"]
    sev = client.get("/incidents", params={"severity": 2}).json()["items"]
    assert [i["title"] for i in sev] == ["i5", "i1"]


def test_list_bad_params(client):
    assert client.get("/incidents", params={"limit": 101}).status_code == 422
    assert client.get("/incidents", params={"status": "closed"}).status_code == 422
    resp = client.get("/incidents", params={"cursor": "garbage"})
    assert resp.status_code == 400 and resp.json()["error"]["code"] == "invalid_cursor"


def test_pagination_tie_breaks_on_id(client):
    for n in range(5):
        _create(client, f"same{n}", 2, "2026-10-01T00:00:00Z")

    seen, cursor = [], None
    while True:
        params = {"limit": 2} | ({"cursor": cursor} if cursor else {})
        page = client.get("/incidents", params=params).json()
        seen += [i["id"] for i in page["items"]]
        if not (cursor := page["next_cursor"]):
            break
    assert len(seen) == len(set(seen)) == 5
    assert seen == sorted(seen, reverse=True)


def test_patch_rejects_resolved_at_on_open_status(client, incident):
    resp = client.patch(
        f"/incidents/{incident['id']}",
        json={"status": "mitigated", "resolved_at": "2026-10-01T15:00:00Z"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"
