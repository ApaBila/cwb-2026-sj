import os
from sqlalchemy import create_engine, text
from pathlib import Path

env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

engine = create_engine(os.environ.get("DATABASE_URL"))

with engine.begin() as connection:
    connection.execute(
        text("TRUNCATE TABLE dependencies, tasks, people, projects RESTART IDENTITY;")
    )
    print(
        "Success: The dependencies, tasks, people, and projects tables have been wiped clean."
    )
