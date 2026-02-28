"""Tests for Flask app routes."""

import pytest

from src.ios_health_dump import upsert_health_dump
from tests.conftest import make_dump

DUMP_DATE = "5. Jan 2026 at 14:30"


@pytest.mark.parametrize(
    "path,expected_status,expected_json",
    [
        ("/status", 200, {"status": "ok"}),
        ("/", 200, None),
        ("/favicon.ico", 200, None),
    ],
)
def test_simple_routes(client, path, expected_status, expected_json):
    """Status, index, favicon return 200."""
    r = client.get(path)
    assert r.status_code == expected_status
    if expected_json:
        assert r.json == expected_json


def test_get_health_data_empty(client):
    """GET /api/health-data returns empty data and zero goals when DB empty."""
    r = client.get("/api/health-data")
    assert r.json["data"] == []
    assert r.json["goals"] == {"steps": 0, "kcals": 0, "km": 0, "flights_climbed": 0}


def test_get_health_data_with_records(client, temp_db):
    """GET /api/health-data returns sorted data and computed goals."""
    upsert_health_dump(make_dump("2026-01-05"))
    upsert_health_dump(make_dump("2026-01-06", steps=8000))
    r = client.get("/api/health-data")
    assert r.json["data"][0]["date"] == "2026-01-06"
    assert "goals" in r.json
    assert r.json["goals"]["steps"] == 9000


@pytest.mark.parametrize(
    "query,expected_count",
    [
        ("?date=2026-01-05", 1),
        ("?date_start=2026-01-05&date_end=2026-01-06", 2),
    ],
)
def test_get_health_data_filters(client, temp_db, query, expected_count):
    """GET /api/health-data respects date filters."""
    upsert_health_dump(make_dump("2026-01-05"))
    upsert_health_dump(make_dump("2026-01-06"))
    upsert_health_dump(make_dump("2026-01-07"))
    r = client.get(f"/api/health-data{query}")
    assert len(r.json["data"]) == expected_count


def test_dump_creates_record(client, temp_db):
    """POST /dump creates health record from JSON."""
    r = client.post("/dump", json={"date": DUMP_DATE, "steps": 10000, "kcals": 500.5, "km": 8.2})
    assert r.status_code == 200
    assert r.json["status"] == "success"
    assert r.json["data"]["date"] == "2026-01-05"
    assert r.json["data"]["steps"] == 10000


@pytest.mark.parametrize("missing_field", ["date", "steps", "kcals", "km"])
def test_dump_requires_fields(client, missing_field):
    """POST /dump returns 400 when required field missing."""
    payload = {"date": DUMP_DATE, "steps": 10000, "kcals": 500.5, "km": 8.2}
    del payload[missing_field]
    r = client.post("/dump", json=payload)
    assert r.status_code == 400
    assert r.json["status"] == "error"


def test_dump_invalid_json(client):
    """POST /dump returns 400 for invalid JSON."""
    r = client.post("/dump", data="not json", content_type="application/json")
    assert r.status_code == 400
