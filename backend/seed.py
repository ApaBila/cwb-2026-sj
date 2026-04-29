import csv
from datetime import date
from pathlib import Path

from app.database import SessionLocal
from app.models import Dependency, Person, Project, Task

DATA_DIR = Path(__file__).resolve().parent.parent / "CWB_SJ"

REQUIRED_CSV_FILES = ["people.csv", "projects.csv", "dependencies.csv", "tasks_master.csv"]

if not DATA_DIR.is_dir():
    raise RuntimeError(
        f"Dataset directory not found: {DATA_DIR}\n"
        "The CWB_SJ submodule has not been initialised. Run:\n"
        "    git submodule update --init --recursive"
    )

missing_files = [f for f in REQUIRED_CSV_FILES if not (DATA_DIR / f).is_file()]
if missing_files:
    raise RuntimeError(
        f"Missing expected CSV file(s) in {DATA_DIR}: {', '.join(missing_files)}\n"
        "Ensure the submodule is fully populated by running:\n"
        "    git submodule update --init --recursive"
    )


def read_csv_rows(filename: str) -> list[dict[str, str]]:
    with (DATA_DIR / filename).open(newline="", encoding="utf-8") as csv_file:
        return list(csv.DictReader(csv_file))


def parse_date(value: str | None) -> date | None:
    if value is None:
        return None

    cleaned_value = value.strip()
    if not cleaned_value:
        return None

    return date.fromisoformat(cleaned_value)


def parse_int(value: str | None) -> int | None:
    if value is None:
        return None

    cleaned_value = value.strip()
    if not cleaned_value:
        return None

    return int(cleaned_value)


def clear_tables(db) -> None:
    db.query(Dependency).delete()
    db.query(Task).delete()
    db.query(Person).delete()
    db.query(Project).delete()


def seed_people(rows: list[dict[str, str]]) -> list[Person]:
    return [
        Person(
            person_id=row["person_id"],
            display_name=row["display_name"],
            role=row["role"] or None,
            discipline=row["discipline"] or None,
            region=row["region"] or None,
            email=row["email"] or None,
        )
        for row in rows
    ]


def seed_projects(rows: list[dict[str, str]]) -> list[Project]:
    return [
        Project(
            project_id=row["project_id"],
            project_name=row["project_name"] or "Unspecified",
            project_timezone="Unspecified",
            region=row["region"] or "Unspecified",
            start_date=row["start_date"] or None,
            target_end_date=row["target_end_date"] or None,
            contract_type=row["contract_type"] or "Unspecified",
        )
        for row in rows
    ]


def seed_dependencies(rows: list[dict[str, str]]) -> list[Dependency]:
    return [
        Dependency(
            dependency_id=row["dependency_id"],
            predecessor_task_id=row["predecessor_task_id"],
            successor_task_id=row["successor_task_id"],
            dependency_type=row["dependency_type"],
        )
        for row in rows
    ]


def seed_tasks(rows: list[dict[str, str]]) -> list[Task]:
    return [
        Task(
            task_id=row["task_id"],
            project_id=row["project_id"],
            task_title=row["task_title"],
            source_date_iso=None,
            owner_id=row["owner_id"] or None,
            owner_name=row["owner_name"] or None,
            start_date_raw=row["planned_start"] or None,
            planned_start=parse_date(row["planned_start"]),
            due_date_raw=row["planned_due"] or None,
            planned_due=parse_date(row["planned_due"]),
            status=row["status"] or "Not started",
            dependency=None,
            percent_complete=parse_int(row["percent_complete"]),
            priority=row["priority"] or "Low",
            source="tasks_master.csv",
            confidence="High",
            action_type="seeded_baseline",
            is_approved=True,
        )
        for row in rows
    ]


print("Seeding baseline data from CWB_SJ dataset...")

db = SessionLocal()
try:
    clear_tables(db)

    people = seed_people(read_csv_rows("people.csv"))
    projects = seed_projects(read_csv_rows("projects.csv"))
    dependencies = seed_dependencies(read_csv_rows("dependencies.csv"))
    tasks = seed_tasks(read_csv_rows("tasks_master.csv"))

    db.add_all(people)
    db.add_all(projects)
    db.add_all(tasks)
    db.add_all(dependencies)
    db.commit()

    print(
        f"Successfully seeded {len(people)} people, {len(projects)} projects, {len(tasks)} tasks, and {len(dependencies)} dependencies.")
except Exception as e:
    db.rollback()
    print(f"Error seeding data: {e}")
finally:
    db.close()
