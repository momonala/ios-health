"""Shared pytest fixtures."""

from datetime import datetime

import pytest

from src.datamodels import HealthDump
from src.db import init_health_dumps_table


def make_dump(date: str, steps: int = 10000, **kwargs) -> HealthDump:
    """Factory for HealthDump with sensible defaults."""
    defaults = {
        "kcals": 500.0,
        "km": 8.0,
        "flights_climbed": 50,
        "weight": 72.5,
        "recorded_at": datetime.fromisoformat(f"{date}T14:30:00"),
    }
    return HealthDump(date=date, steps=steps, **{**defaults, **kwargs})


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Temp DB path with table initialized."""
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("src.db.DB_PATH", db_file)
    init_health_dumps_table()
    return db_file


@pytest.fixture
def client(temp_db):
    """Flask test client with temp DB."""
    from src.app import app

    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
