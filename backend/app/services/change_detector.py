import uuid
from sqlalchemy.orm import Session
from ..models import Task, Project, Person
from ..schemas import TaskUpdate
from agent_framework import tool
from app.database import SessionLocal
from sqlalchemy import text
import json

from contextvars import ContextVar
from typing import Any, Callable

StreamEmit = Callable[[dict[str, Any]], None]
stream_progress_emit: ContextVar[StreamEmit | None] = ContextVar(
    "stream_progress_emit", default=None
)

# Sync tools (e.g. query_existing_tasks) often run off the asyncio context; ContextVar is
# unset there. The SSE worker sets this to the same callback as stream_progress_emit.
_stream_emit_fallback: StreamEmit | None = None


def set_stream_progress_fallback(fn: StreamEmit | None) -> None:
    global _stream_emit_fallback
    _stream_emit_fallback = fn


def clear_stream_progress_fallback() -> None:
    global _stream_emit_fallback
    _stream_emit_fallback = None


def try_emit_progress(payload: dict[str, Any]) -> None:
    fn = stream_progress_emit.get() or _stream_emit_fallback
    if fn is not None:
        fn(payload)

# TODO: separate tools, use "SELECT"+append, update prompt with SOP
@tool(approval_mode="never_require", max_invocations=7)
def query_existing_tasks(query_str: str):
    """Tool function to query the database. 
    Must be one query string that starts with SELECT. 
    This can be used by the AI agent to compare against incoming task updates for change detection.
    All tables can be queried, including tasks, projects, people, dependencies."""
    if not query_str.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT queries are allowed")

    if ";" in query_str.strip().rstrip(";"):
        raise ValueError("Only one query at a time is allowed")

    q = query_str.strip()
    if "ORDER BY" not in q.upper():
        q_upper = q.upper()
        if " FROM TASKS" in q_upper:
            q = f"{q} ORDER BY task_id"
        elif " FROM PROJECTS" in q_upper:
            q = f"{q} ORDER BY project_id"
        elif " FROM PEOPLE" in q_upper:
            q = f"{q} ORDER BY person_id"
        elif " FROM DEPENDENCIES" in q_upper:
            q = f"{q} ORDER BY dependency_id"

    with SessionLocal() as db:
        result = db.execute(text(q)).mappings().all()
    print(f"\nQuery: {query_str}")
    print(f"\nResult: {result}")
    try_emit_progress(
        {
            "kind": "db",
            "query": query_str.strip(),
            "rows": len(result),
        }
    )
    return json.dumps(list(result), default=str, sort_keys=True)

#TODO: draft flip bug, separate detection vs insert to db
def detect_changes_batched(db: Session, task_updates: list[TaskUpdate]):
    """Detects if the tasks caught by the AI are new, updates, or require clarification due to conflicts 
    based on the existing task data in Azure's PostgreSQL database. 
    Also validates that referenced projects, people exist.
    Inserts new tasks or updates existing rows as unapproved tasks (drafts).
    Prints to terminal of uvicorn for debugging purposes."""
    if not task_updates:
        return

    # Filter out schema-only fields related to other tables before any operations on the table tasks
    def extract_task_data(task_update: TaskUpdate) -> dict:
        task_data = task_update.model_dump(exclude_none=True)
        task_data.pop("project_name", None)
        task_data.pop("project_timezone", None)
        task_data.pop("discipline", None)
        return task_data

    task_names = [t.task_title for t in task_updates]
    # Load existing tasks
    existing_tasks = db.query(Task).filter(
        Task.task_title.in_(task_names)).all()
    existing_task_map = {task.task_title: task for task in existing_tasks}

    # Load referenced projects and people for validation
    project_ids = {t.project_id for t in task_updates if t.project_id}
    owner_ids = {t.owner_id for t in task_updates if t.owner_id}

    existing_projects = db.query(Project).filter(
        Project.project_id.in_(project_ids)).all() if project_ids else []
    existing_project_map = {p.project_id: p for p in existing_projects}

    existing_people = db.query(Person).filter(
        Person.person_id.in_(owner_ids)).all() if owner_ids else []
    existing_person_map = {p.person_id: p for p in existing_people}

    pending_rows: list[dict] = []
    task_columns = {c.key for c in Task.__table__.columns}

    for task_update in task_updates:
        print("Detecting changes for task:", task_update.task_title)
        print("Action type from AI:", task_update.action_type)
        print(f"Task ID: {task_update.task_id}")

        existing_task = existing_task_map.get(
            task_update.task_title)  # type: ignore

        # Validate referenced entities
        project_exists = task_update.project_id in existing_project_map if task_update.project_id else True
        person_exists = task_update.owner_id in existing_person_map if task_update.owner_id else True
        entities_valid = project_exists and person_exists

        if not entities_valid:
            print(
                f"Referenced entities missing: project_exists={project_exists}, person_exists={person_exists}")
            final_action = "conflict_needs_clarification"

        try:
            task_data = extract_task_data(task_update)

            # Ensure task_id is never None (primary key requirement)
            if not task_data.get("task_id"):
                task_data["task_id"] = f"DRAFT_{uuid.uuid4().hex[:8].upper()}"
                print(f"Generated new task_id: {task_data['task_id']}")

            task_data["is_approved"] = False
            pending_rows.append(task_data)
        except Exception as e:
            print(
                f"Error formatting draft for '{task_update.task_title}': {e}")
            continue

    if not pending_rows:
        return

    task_ids = [row["task_id"] for row in pending_rows]
    existing_by_id = {
        t.task_id: t
        for t in db.query(Task).filter(Task.task_id.in_(task_ids)).all()
    }

    for task_data in pending_rows:
        filtered = {k: v for k, v in task_data.items() if k in task_columns}
        tid = filtered["task_id"]
        if tid in existing_by_id:
            row = existing_by_id[tid]
            for key, value in filtered.items():
                setattr(row, key, value)
        else:
            db.add(Task(**filtered))

    try:
        db.commit()
        print(f"Successfully committed {len(pending_rows)} task drafts.")
    except Exception as e:
        db.rollback()
        print(f"Error committing task drafts: {e}")
        raise
