"""Module for handling iOS health dump data."""

import logging
from datetime import datetime

from datamodels import HealthDump
from db import TABLE_NAME
from db import get_db_connection

logger = logging.getLogger(__name__)


def init_health_dumps_table():
    """Initialize the health_dumps table if it doesn't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{TABLE_NAME}'")
    if not cursor.fetchone():
        cursor.execute(
            f"""
            CREATE TABLE {TABLE_NAME} (
                date TEXT PRIMARY KEY,
                steps INTEGER NOT NULL,
                kcals REAL NOT NULL,
                km REAL NOT NULL,
                recorded_at TEXT NOT NULL
            )
        """
        )
        conn.commit()
        logger.debug("✅ Health dumps table initialized")

    conn.close()


def upsert_health_dump(health_dump: HealthDump) -> int:
    """Upsert a health dump entry. Keeps only the latest entry per day."""
    try:
        init_health_dumps_table()
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(f"SELECT recorded_at FROM {TABLE_NAME} WHERE date = ?", (health_dump.date,))
        existing = cursor.fetchone()

        should_update = True
        if existing:
            existing_recorded_at = datetime.fromisoformat(existing["recorded_at"])
            if health_dump.recorded_at <= existing_recorded_at:
                should_update = False
                logger.info(f"⏭️ Skipping older health dump for {health_dump.date}")

        if should_update:
            cursor.execute(
                f"""
                INSERT OR REPLACE INTO {TABLE_NAME} (date, steps, kcals, km, recorded_at)
                VALUES (?, ?, ?, ?, ?)
            """,
                (
                    health_dump.date,
                    health_dump.steps,
                    health_dump.kcals,
                    health_dump.km,
                    health_dump.recorded_at.isoformat(),
                ),
            )
            conn.commit()
            logger.debug(f"✅ Successfully upserted health dump for {health_dump.date}")

        cursor.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}")
        row_count = cursor.fetchone()[0]
        conn.close()
        return row_count
    except Exception as e:
        logger.exception("❌ Failed to upsert health dump", exc_info=True)
        raise RuntimeError(f"Failed to upsert health dump: {str(e)}")


if __name__ == "__main__":
    init_health_dumps_table()
