"""Tests for ios_health_dump - upsert and get_all_health_data logic."""

from datetime import datetime

import pytest

from src.db import TABLE_NAME
from src.db import db_transaction
from src.ios_health_dump import get_all_health_data
from src.ios_health_dump import upsert_health_dump
from tests.conftest import make_dump


def test_upsert_inserts_new_and_updates_when_newer(temp_db):
    """upsert inserts new record; newer recorded_at overwrites older."""
    older = make_dump("2026-01-05", steps=5000, recorded_at=datetime(2026, 1, 5, 10, 0, 0))
    newer = make_dump("2026-01-05", steps=10000)
    assert upsert_health_dump(older) == 1
    assert upsert_health_dump(newer) == 1
    with db_transaction() as (conn, cursor):
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE date = ?", ("2026-01-05",))
        row = cursor.fetchone()
    assert row["steps"] == 10000


def test_upsert_skips_older_preserves_newer(temp_db):
    """upsert skips when incoming recorded_at is older; preserves weight merge."""
    newer = make_dump("2026-01-05", weight=None, recorded_at=datetime(2026, 1, 5, 20, 0, 0))
    older = make_dump("2026-01-05", steps=5000, weight=72.5, recorded_at=datetime(2026, 1, 5, 10, 0, 0))
    upsert_health_dump(newer)
    upsert_health_dump(older)
    with db_transaction() as (conn, cursor):
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE date = ?", ("2026-01-05",))
        row = cursor.fetchone()
    assert row["steps"] == 10000
    assert row["weight"] == 72.5


@pytest.mark.parametrize(
    "date_start,date_end,expected_dates",
    [
        (None, None, ["2026-01-07", "2026-01-06", "2026-01-05"]),
        ("2026-01-06", None, ["2026-01-07", "2026-01-06"]),
        (None, "2026-01-06", ["2026-01-06", "2026-01-05"]),
        ("2026-01-06", "2026-01-06", ["2026-01-06"]),
    ],
)
def test_get_all_health_data_date_filters(temp_db, date_start, date_end, expected_dates):
    """get_all_health_data filters by date_start/date_end and sorts DESC."""
    for d in ["2026-01-05", "2026-01-06", "2026-01-07"]:
        upsert_health_dump(make_dump(d))
    result = get_all_health_data(date_start=date_start, date_end=date_end)
    assert [r["date"] for r in result] == expected_dates


def test_get_all_health_data_empty_and_structure(temp_db):
    """get_all_health_data returns [] when empty; structure when populated."""
    assert get_all_health_data() == []
    upsert_health_dump(make_dump("2026-01-05"))
    rows = get_all_health_data()
    assert len(rows) == 1
    assert set(rows[0]) >= {"date", "steps", "kcals", "km", "flights_climbed", "weight", "recorded_at"}
