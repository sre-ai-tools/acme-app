START = "2026-10-01T14:00:00Z"


def make(client, title, owner, body, severity=2):
    incident = client.post(
        "/incidents",
        json={"title": title, "severity": severity, "started_at": START, "owner": owner},
    ).json()
    client.post(
        f"/incidents/{incident['id']}/events",
        json={"occurred_at": START, "kind": "note", "body": body},
    )
    return incident


def test_search_matches_event_text(client):
    hit = make(client, "Checkout", "Alice", "connection pool exhausted", severity=1)
    make(client, "Search", "Bob", "latency spike")

    results = client.get("/search", params={"q": "pool"}).json()
    assert [r["id"] for r in results] == [hit["id"]]
    assert results[0]["owner_handle"] == "alice"
    assert results[0]["escalation_url"].startswith("https://pager.example.com/")


def test_search_treats_wildcards_literally(client):
    make(client, "A", "Alice", "100% CPU")
    make(client, "B", "Bob", "1000 CPU")
    assert [r["title"] for r in client.get("/search", params={"q": "0% C"}).json()] == ["A"]


def test_search_rejects_short_queries(client):
    assert client.get("/search", params={"q": "ab"}).status_code == 422
