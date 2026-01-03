import logging
from datetime import datetime

import pytz
from flask import Flask
from flask import jsonify
from flask import render_template
from flask import request

from datamodels import HealthDump
from db import get_all_health_data
from ios_health_dump import upsert_health_dump

app = Flask(__name__, static_url_path="/static", static_folder="static", template_folder="templates")

logging.basicConfig(level=logging.INFO)
# logging.getLogger("werkzeug").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


@app.route("/", methods=["GET"])
def index():
    """Serve the dashboard."""
    return render_template("index.html")


@app.route("/status", methods=["GET"])
def status():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/api/health-data", methods=["GET"])
def get_health_data():
    """Get all health data for the dashboard."""
    data = get_all_health_data()
    return jsonify({"data": data})


@app.route("/dump", methods=["POST"])
def dump():
    """Save health dump from iOS app to database."""
    data = request.get_json()

    berlin_tz = pytz.timezone("Europe/Berlin")
    now = datetime.now(berlin_tz)
    date_str = now.replace(hour=0, minute=0, second=0, microsecond=0).date().isoformat()

    health_dump = HealthDump(
        date=date_str,
        steps=int(data["steps"]),
        kcals=float(data["kcals"]),
        km=float(data["km"]),
        recorded_at=now,
    )

    row_count = upsert_health_dump(health_dump)
    logger.info(f"📲 Saved health dump for iOS app: {health_dump.date} - {data} (rows: {row_count:,})")
    return jsonify({"status": "success", "data": health_dump.to_dict(), "row_count": row_count}), 200


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5009)
