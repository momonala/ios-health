"""Tests for data_backup_scheduler - git commit and push logic."""

import subprocess
from datetime import datetime
from unittest.mock import patch

import pytest

from src.data_backup_scheduler import commit_if_changed
from src.data_backup_scheduler import force_push_to_git
from src.data_backup_scheduler import run_command


@patch("src.data_backup_scheduler.subprocess.run")
def test_run_command_returns_stdout(mock_run):
    """run_command returns stripped stdout on success."""
    mock_run.return_value = subprocess.CompletedProcess(["echo", "hello"], 0, stdout="  hello  \n", stderr="")
    assert run_command(["echo", "hello"]) == "hello"


@patch("src.data_backup_scheduler.subprocess.run")
def test_run_command_raises_on_nonzero(mock_run):
    """run_command raises CalledProcessError when check=True and returncode != 0."""
    mock_run.return_value = subprocess.CompletedProcess(["false"], 1, stdout="", stderr="error")
    with pytest.raises(subprocess.CalledProcessError):
        run_command(["false"])


@patch("src.data_backup_scheduler.subprocess.run")
def test_run_command_check_false_returns_stdout(mock_run):
    """run_command with check=False returns stdout even on non-zero."""
    mock_run.return_value = subprocess.CompletedProcess(["cmd"], 1, stdout="out", stderr="err")
    assert run_command(["cmd"], check=False) == "out"


@patch("src.data_backup_scheduler.run_command")
def test_force_push_to_git_logs_on_failure(mock_run):
    """force_push_to_git catches CalledProcessError and logs warning."""
    mock_run.side_effect = subprocess.CalledProcessError(1, ["git", "push"], "out", "err")
    force_push_to_git(["git", "push", "origin", "main"], "msg")
    mock_run.assert_called_once_with(["git", "push", "origin", "main"])


@patch("src.data_backup_scheduler.run_command")
def test_commit_if_changed_skips_when_no_diff(mock_run, tmp_path):
    """commit_if_changed returns early when no diff."""
    db_file = tmp_path / "health.db"
    db_file.touch()
    with patch("src.data_backup_scheduler.file_to_commit", db_file):
        mock_run.return_value = ""
        commit_if_changed()
    mock_run.assert_called_once()
    assert mock_run.call_args[0][0][:2] == ["git", "diff"]


@patch("src.data_backup_scheduler.run_command")
def test_commit_if_changed_creates_commit_when_diff(mock_run, tmp_path):
    """commit_if_changed adds, commits, and pushes when diff exists."""
    db_file = tmp_path / "health.db"
    db_file.touch()
    with (
        patch("src.data_backup_scheduler.file_to_commit", db_file),
        patch("src.data_backup_scheduler.datetime") as mock_dt,
    ):
        mock_dt.now.return_value.date.return_value = datetime(2026, 1, 5).date()
        mock_run.side_effect = ["diff", None, "old message", None, None, None]

        commit_if_changed()

    calls = [c[0][0] for c in mock_run.call_args_list]
    assert ["git", "add", db_file] in calls
    assert any("commit" in str(c) and "2026-01-05" in str(c) for c in calls)
    assert ["git", "push", "origin", "main"] in calls
