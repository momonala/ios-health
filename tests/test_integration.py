"""Integration tests - end-to-end flows only."""

DUMP_DATE = "5. Jan 2026 at 14:30"


def test_dump_to_api_flow(client, temp_db):
    """POST /dump -> GET /api/health-data returns same data."""
    client.post("/dump", json={"date": DUMP_DATE, "steps": 12000, "kcals": 550.0, "km": 9.5})
    r = client.get("/api/health-data")
    assert r.json["data"][0]["steps"] == 12000


def test_newer_dump_overwrites_older(client, temp_db):
    """Later dump for same day overwrites earlier."""
    client.post("/dump", json={"date": "5. Jan 2026 at 10:00", "steps": 5000, "kcals": 250.0, "km": 4.0})
    client.post("/dump", json={"date": "5. Jan 2026 at 20:00", "steps": 10000, "kcals": 500.0, "km": 8.0})
    r = client.get("/api/health-data")
    assert r.json["data"][0]["steps"] == 10000


def test_optional_flights_omitted(client, temp_db):
    """Dump accepts payload without flights_climbed."""
    r = client.post("/dump", json={"date": DUMP_DATE, "steps": 10000, "kcals": 500.0, "km": 8.0})
    assert r.status_code == 200
    assert r.json["data"]["flights_climbed"] is None
