import os
from sqlalchemy import create_engine, text
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

engine = create_engine(os.environ.get("DATABASE_URL"))

with engine.begin() as connection:
    connection.execute(
        text("TRUNCATE TABLE dependencies, tasks, people, projects RESTART IDENTITY;")
    )
    print(
        "Success: The dependencies, tasks, people, and projects tables have been wiped clean."
    )
