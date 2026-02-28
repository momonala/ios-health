"""Tests for db module - transaction and init logic only."""

import pytest

from src.db import TABLE_NAME
from src.db import db_transaction
from src.db import init_health_dumps_table


def test_db_transaction_commits_and_rolls_back(temp_db):
    """db_transaction commits on success, rolls back on exception."""
    with db_transaction() as (conn, cursor):
        cursor.execute(
            f"INSERT INTO {TABLE_NAME} (date, steps, kcals, km, recorded_at) VALUES (?, ?, ?, ?, ?)",
            ("2026-01-05", 10000, 500.5, 8.2, "2026-01-05T14:30:00"),
        )
    with db_transaction() as (conn, cursor):
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE date = ?", ("2026-01-05",))
        assert cursor.fetchone() is not None

    with pytest.raises(ValueError):
        with db_transaction() as (conn, cursor):
            cursor.execute(
                f"INSERT INTO {TABLE_NAME} (date, steps, kcals, km, weight, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
                ("2026-01-06", 0, 0, 0, 0, "2026-01-06T00:00:00"),
            )
            raise ValueError("abort")
    with db_transaction() as (conn, cursor):
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE date = ?", ("2026-01-06",))
        assert cursor.fetchone() is None


def test_init_health_dumps_table_schema_and_idempotent(temp_db):
    """init_health_dumps_table creates schema and is idempotent."""
    with db_transaction() as (conn, cursor):
        cursor.execute(f"PRAGMA table_info({TABLE_NAME})")
        cols = {r[1] for r in cursor.fetchall()}
    assert cols >= {"date", "steps", "kcals", "km", "weight", "recorded_at"}

    with db_transaction() as (conn, cursor):
        cursor.execute(
            f"INSERT INTO {TABLE_NAME} (date, steps, kcals, km, weight, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("2026-01-05", 10000, 500.5, 8.2, 72.5, "2026-01-05T14:30:00"),
        )
    init_health_dumps_table()
    with db_transaction() as (conn, cursor):
        cursor.execute(f"SELECT * FROM {TABLE_NAME} WHERE date = ?", ("2026-01-05",))
        assert cursor.fetchone() is not None
