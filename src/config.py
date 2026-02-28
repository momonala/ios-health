import tomllib
from pathlib import Path

import typer

_config_file = Path(__file__).parent.parent / "pyproject.toml"
with _config_file.open("rb") as f:
    _config = tomllib.load(f)

_project_config = _config["project"]
_tool_config = _config["tool"]["config"]

FLASK_PORT = _tool_config["flask_port"]
DATABASE_PATH = _tool_config["database_path"]
GOAL_OUTLIER_STEPS_MAX = _tool_config.get("goal_outlier_steps_max", 20000)
GOAL_OUTLIER_KM_MAX = _tool_config.get("goal_outlier_km_max", 18)
GOAL_OUTLIER_FLIGHTS_MAX = _tool_config.get("goal_outlier_flights_max", 20)
GOAL_OUTLIER_KCALS_MAX = _tool_config.get("goal_outlier_kcals_max", 600)


# fmt: off
def config_cli(
    all: bool = typer.Option(False, "--all", help="Show all configuration values"),
    project_name: bool = typer.Option(False, "--project-name", help=_project_config['name']),
    project_version: bool = typer.Option(False, "--project-version", help=_project_config['version']),
    flask_port: bool = typer.Option(False, "--flask-port", help=str(FLASK_PORT)),
    database_path: bool = typer.Option(False, "--database-path", help=DATABASE_PATH),
) -> None:
# fmt: on
    if all:
        typer.echo(f"project_name={_project_config['name']}")
        typer.echo(f"project_version={_project_config['version']}")
        typer.echo(f"flask_port={FLASK_PORT}")
        typer.echo(f"database_path={DATABASE_PATH}")
        return

    if project_name:
        typer.echo(_project_config["name"])
        return
    if project_version:
        typer.echo(_project_config["version"])
        return
    if flask_port:
        typer.echo(FLASK_PORT)
        return
    if database_path:
        typer.echo(DATABASE_PATH)
        return

    typer.secho("Error: No config key specified. Use --help to see available options.", fg=typer.colors.RED, err=True)
    raise typer.Exit(1)


def main() -> None:
    typer.run(config_cli)


if __name__ == "__main__":
    main()
