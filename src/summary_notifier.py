import logging
import math
from datetime import datetime
from datetime import timedelta

import requests

from src.ios_health_dump import get_all_health_data
from src.secrets import TELEGRAM_CHAT_ID
from src.secrets import TELEGRAM_TOKEN

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _round_up_to_nearest(value: float, nearest: int) -> int:
    """Round value up to the nearest multiple of nearest e.g. 10, 100, 1000)."""
    return int(math.ceil(value / nearest) * nearest)


def _goal_reached(percent: float) -> str:
    return "✅" if percent >= 1 else "❌"


def send_summary_message_to_telegram():
    """Fetches health stats/goals from the previous day and sends via telegram"""
    start_date = (datetime.now().date() - timedelta(days=365)).isoformat()
    end_date = (datetime.now().date() - timedelta(days=1)).isoformat()
    health_stats = get_all_health_data(date_start=start_date, date_end=end_date)

    today_stats = health_stats[0]
    if today_stats["date"] != end_date:
        raise RuntimeError(
            f"Fetched health stats for wrong dates. Expected {end_date} but got {today_stats['date']}"
        )
    today_stats["kcals"] = int(today_stats["kcals"])
    today_stats["km"] = round(today_stats["km"], 2)

    # rm nones
    flights = list(filter(None, [s["flights_climbed"] for s in health_stats]))
    weights = list(filter(None, [s["weight"] for s in health_stats]))
    latest_weight = weights[0]

    avg_stats = {
        "steps": _round_up_to_nearest(sum(s["steps"] for s in health_stats) / len(health_stats), 1000),
        "kcals": _round_up_to_nearest(sum(s["kcals"] for s in health_stats) / len(health_stats), 100),
        "km": _round_up_to_nearest(sum(s["km"] for s in health_stats) / len(health_stats), 1),
        "flights_climbed": _round_up_to_nearest(sum(flights) / len(flights), 1),
    }

    steps_percent = today_stats["steps"] / avg_stats["steps"]
    kcals_percent = today_stats["kcals"] / avg_stats["kcals"]
    km_percent = today_stats["km"] / avg_stats["km"]
    flights_percent = today_stats["flights_climbed"] / avg_stats["flights_climbed"]

    formatted_date = datetime.strptime(today_stats["date"], "%Y-%m-%d").strftime("%d %b, %Y")
    message = f"🩷 Health stats for {formatted_date}"
    message += f"\n{_goal_reached(steps_percent)} Steps: {steps_percent:.0%} - {today_stats['steps']}/{avg_stats['steps']}"
    message += f"\n{_goal_reached(kcals_percent)} Kcals: {kcals_percent:.0%} - {today_stats['kcals']}/{avg_stats['kcals']}"
    message += f"\n{_goal_reached(km_percent)} Km: {km_percent:.0%} - {today_stats['km']}/{avg_stats['km']}"
    message += f"\n{_goal_reached(flights_percent)} Flights: {flights_percent:.0%} - {today_stats['flights_climbed']}/{avg_stats['flights_climbed']}"
    message += f"\nWeight: {latest_weight}"
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message}

    try:
        requests.post(url, json=payload, timeout=10)
        logger.info(f"{message}. Telegram alert sent.")
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")


if __name__ == "__main__":
    send_summary_message_to_telegram()
