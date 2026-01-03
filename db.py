"""Common database utilities."""

import sqlite3
from pathlib import Path

DB_PATH = Path("health_dumps.db")
TABLE_NAME = "health_dumps"


def get_db_connection():
    """Get a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_all_health_data() -> list[dict[str, any]]:
    """Get all health data from the database, sorted by date (most recent first)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        f"""
        SELECT date, steps, kcals, km, recorded_at 
        FROM {TABLE_NAME} 
        ORDER BY date DESC
    """
    )
    rows = cursor.fetchall()
    conn.close()

    data = [
        {
            "date": row["date"],
            "steps": row["steps"],
            "kcals": row["kcals"],
            "km": row["km"],
            "recorded_at": row["recorded_at"],
        }
        for row in rows
    ]

    return data
