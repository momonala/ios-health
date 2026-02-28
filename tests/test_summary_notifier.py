"""Tests for summary_notifier - Telegram health stats."""

from datetime import datetime
from datetime import timedelta
from unittest.mock import patch

import pytest
import requests

from src.summary_notifier import send_summary_message_to_telegram


@patch("src.summary_notifier.requests.post")
@patch("src.summary_notifier.get_goals")
@patch("src.summary_notifier.get_all_health_data")
def test_send_summary_posts_to_telegram(mock_get_data, mock_get_goals, mock_post):
    """send_summary_message_to_telegram fetches data, builds message, posts to Telegram."""
    yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
    mock_get_data.return_value = [
        {
            "date": yesterday,
            "steps": 8000,
            "kcals": 400.0,
            "km": 6.5,
            "flights_climbed": 30,
            "weight": 72.5,
        }
    ]
    mock_get_goals.return_value = {"steps": 8000, "kcals": 400, "km": 7, "flights_climbed": 30}

    send_summary_message_to_telegram()

    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "sendMessage" in call_args[0][0]
    assert call_args[1]["json"]["text"].startswith("🩷 Health stats")
    assert "8000" in call_args[1]["json"]["text"]
    assert call_args[1]["timeout"] == 10


@patch("src.summary_notifier.get_all_health_data")
def test_send_summary_raises_when_no_data(mock_get_data):
    """send_summary_message_to_telegram raises RuntimeError when no health stats."""
    mock_get_data.return_value = []

    with pytest.raises(RuntimeError, match="No health stats found"):
        send_summary_message_to_telegram()


@patch("src.summary_notifier.requests.post")
@patch("src.summary_notifier.get_goals")
@patch("src.summary_notifier.get_all_health_data")
def test_send_summary_handles_request_failure(mock_get_data, mock_get_goals, mock_post):
    """send_summary_message_to_telegram logs error on RequestException, does not raise."""
    yesterday = (datetime.now().date() - timedelta(days=1)).isoformat()
    mock_get_data.return_value = [
        {
            "date": yesterday,
            "steps": 8000,
            "kcals": 400.0,
            "km": 6.5,
            "flights_climbed": 30,
            "weight": 72.5,
        }
    ]
    mock_get_goals.return_value = {"steps": 8000, "kcals": 400, "km": 7, "flights_climbed": 30}
    mock_post.side_effect = requests.RequestException("Connection refused")

    send_summary_message_to_telegram()

    mock_post.assert_called_once()
