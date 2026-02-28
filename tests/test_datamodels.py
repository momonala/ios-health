"""Tests for HealthDump serialization - our logic only."""

from datetime import datetime
from datetime import timezone

import pytest

from src.datamodels import HealthDump


def test_to_dict_roundtrip():
    """to_dict and from_dict round-trip preserves data."""
    dump = HealthDump(
        date="2026-01-05",
        steps=10000,
        kcals=500.5,
        km=8.2,
        flights_climbed=50,
        weight=72.5,
        recorded_at=datetime(2026, 1, 5, 14, 30, 0),
    )
    restored = HealthDump.from_dict(dump.to_dict())
    assert restored.date == dump.date
    assert restored.steps == dump.steps
    assert restored.weight == dump.weight
    assert restored.recorded_at == dump.recorded_at


@pytest.mark.parametrize(
    "recorded_at_input,expected_tz",
    [
        ("2026-01-05T14:30:00", None),
        ("2026-01-05T14:30:00Z", timezone.utc),
        (datetime(2026, 1, 5, 14, 30, 0), None),
        (None, None),
    ],
)
def test_from_dict_recorded_at_variants(recorded_at_input, expected_tz):
    """from_dict handles recorded_at as string, datetime, or None."""
    data = {
        "date": "2026-01-05",
        "steps": 10000,
        "kcals": 500.5,
        "km": 8.2,
        "flights_climbed": 50,
        "weight": 72.5,
    }
    if recorded_at_input is not None:
        data["recorded_at"] = recorded_at_input
    result = HealthDump.from_dict(data)
    assert result.date == "2026-01-05"
    if expected_tz is not None:
        assert result.recorded_at.tzinfo == expected_tz
    elif isinstance(recorded_at_input, datetime):
        assert result.recorded_at == recorded_at_input


def test_from_dict_requires_date():
    """from_dict raises KeyError when date is missing."""
    with pytest.raises(KeyError):
        HealthDump.from_dict({"steps": 10000, "recorded_at": "2026-01-05T14:30:00"})
