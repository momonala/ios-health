import logging
import subprocess
import time
from datetime import datetime

import schedule

from db import DB_PATH

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BRANCH = "main"
file_to_commit = DB_PATH


def run_command(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip()


def commit_if_changed():
    diff = run_command(["git", "diff", file_to_commit])
    if diff:
        run_command(["git", "add", file_to_commit])
        msg = f"Updated {file_to_commit}: {datetime.now().date()}"
        run_command(["git", "commit", "-m", msg])
        run_command(["git", "push", "origin", BRANCH])
        run_command(["cp", file_to_commit, f"{file_to_commit}.bk"])
        logger.info(f"✅ [{datetime.now()}] Changes committed.")
    else:
        logger.info(f"⏭️ [{datetime.now()}] No changes. Skipping commit.")


if __name__ == "__main__":
    schedule.every().hour.at(":00").do(commit_if_changed)
    logger.info("⏰ Init scheduler!")
    logger.info(f"⏰ {schedule.get_jobs()}")

    while True:
        schedule.run_pending()
        time.sleep(30)
