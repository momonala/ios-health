"""Shared health goal/average logic for Telegram notifier and API."""

import logging
import math
from datetime import datetime
from datetime import timedelta

from src.ios_health_dump import get_all_health_data

logger = logging.getLogger(__name__)


def _round_up_to_nearest(value: float, nearest: int) -> int:
    """Round value up to the nearest multiple of nearest (e.g. 10, 100, 1000)."""
    return int(math.ceil(value / nearest) * nearest)


def _compute_goals(health_stats: list[dict]) -> dict[str, int]:
    """Compute goal dict from a list of health stats. Averages: steps/kcals/km over all days;
    flights over non-null only. Rounded up: steps 1000, kcals 100, km and flights 1.
    """
    if not health_stats:
        return {"steps": 0, "kcals": 0, "km": 0, "flights_climbed": 0}

    n = len(health_stats)
    steps_avg = sum(s.get("steps") or 0 for s in health_stats) / n
    kcals_avg = sum(s.get("kcals") or 0 for s in health_stats) / n
    km_avg = sum(s.get("km") or 0 for s in health_stats) / n

    flights_values = [s["flights_climbed"] for s in health_stats if s.get("flights_climbed") is not None]
    flights_avg = sum(flights_values) / len(flights_values) if flights_values else 0.0

    return {
        "steps": _round_up_to_nearest(steps_avg, 1000) if steps_avg > 0 else 0,
        "kcals": _round_up_to_nearest(kcals_avg, 100) if kcals_avg > 0 else 0,
        "km": _round_up_to_nearest(km_avg, 1) if km_avg > 0 else 0,
        "flights_climbed": _round_up_to_nearest(flights_avg, 1) if flights_avg > 0 else 0,
    }


def get_goals(data: list[dict] | None = None, last_n_days: int = 365) -> dict[str, int]:
    """Return goals dict. If data is None, fetches last_n_days from DB and computes; else computes from data."""
    if data is not None:
        return _compute_goals(data)

    today = datetime.now().date()
    date_start = (today - timedelta(days=last_n_days)).isoformat()
    date_end = today.isoformat()
    data = get_all_health_data(date_start=date_start, date_end=date_end)
    goals = _compute_goals(data)
    logger.info("📊 Goals: last %d days (%d rows)=%s", last_n_days, len(data), goals)
    return goals
