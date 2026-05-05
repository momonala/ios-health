import logging
import os
from datetime import datetime
from datetime import timedelta

import requests

from src.health_goals import get_goals
from src.ios_health_dump import get_all_health_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _goal_reached(percent: float) -> str:
    return "✅" if percent >= 1 else "❌"


def _get_required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def send_summary_message_to_telegram() -> None:
    """Fetches health stats/goals from the previous day and sends via telegram."""
    telegram_token = _get_required_env("TELEGRAM_TOKEN")
    telegram_chat_id = _get_required_env("TELEGRAM_CHAT_ID")

    start_date = (datetime.now().date() - timedelta(days=365)).isoformat()
    end_date = (datetime.now().date() - timedelta(days=1)).isoformat()
    health_stats = get_all_health_data(date_start=start_date, date_end=end_date)

    if not health_stats:
        raise RuntimeError(f"No health stats found for date range ending {end_date}")

    yesterday_stats = health_stats[0]
    if yesterday_stats["date"] != end_date:
        raise RuntimeError(
            f"Fetched health stats for wrong dates. Expected {end_date} but got {yesterday_stats['date']}"
        )
    yesterday_stats["kcals"] = int(yesterday_stats["kcals"])
    yesterday_stats["km"] = round(yesterday_stats["km"], 2)

    weights = [s["weight"] for s in health_stats if s.get("weight") is not None]
    latest_weight = weights[0] if weights else "--"

    avg_stats = get_goals(data=health_stats)

    steps_percent = yesterday_stats["steps"] / avg_stats["steps"] if avg_stats["steps"] else 0
    kcals_percent = yesterday_stats["kcals"] / avg_stats["kcals"] if avg_stats["kcals"] else 0
    km_percent = yesterday_stats["km"] / avg_stats["km"] if avg_stats["km"] else 0
    flights_percent = (
        yesterday_stats["flights_climbed"] / avg_stats["flights_climbed"]
        if avg_stats["flights_climbed"]
        else 0
    )

    formatted_date = datetime.strptime(yesterday_stats["date"], "%Y-%m-%d").strftime("%d %b, %Y")
    message = f"🩷 Health stats for {formatted_date}"
    message += f"\n{_goal_reached(steps_percent)} Steps: {steps_percent:.0%} - {yesterday_stats['steps']}/{avg_stats['steps']}"
    message += f"\n{_goal_reached(kcals_percent)} Kcals: {kcals_percent:.0%} - {yesterday_stats['kcals']}/{avg_stats['kcals']}"
    message += (
        f"\n{_goal_reached(km_percent)} Km: {km_percent:.0%} - {yesterday_stats['km']}/{avg_stats['km']}"
    )
    message += f"\n{_goal_reached(flights_percent)} Flights: {flights_percent:.0%} - {yesterday_stats['flights_climbed']}/{avg_stats['flights_climbed']}"
    message += f"\nWeight: {latest_weight}"
    url = f"https://api.telegram.org/bot{telegram_token}/sendMessage"
    payload = {"chat_id": telegram_chat_id, "text": message}

    try:
        requests.post(url, json=payload, timeout=10)
        logger.debug(f"{message}. Telegram alert sent.")
    except requests.RequestException as e:
        logger.error("Failed to send Telegram message: %s", e)


if __name__ == "__main__":
    send_summary_message_to_telegram()
