import uuid
from sqlalchemy.orm import Session
from ..models import Task, Project, Person, Dependency
from ..schemas import TaskUpdate
from agent_framework import tool
from app.database import SessionLocal
from sqlalchemy import text

# https://github.com/Azure-Samples/postgres-agents/tree/main/azure-ai-agent-service


@tool(approval_mode="never_require")
def query_existing_tasks(query_str: str):
    """Tool function to query the database. This can be used by the AI agent to compare against incoming task updates for change detection."""
    with SessionLocal() as db:
        result = db.execute(text(query_str)).all()
    print(result)
    return result


def detect_changes_batched(db: Session, task_updates: list[TaskUpdate]):
    """Detects if the tasks caught by the AI are new, updates, or require clarification due to conflicts 
    based on the existing task data in Azure's PostgreSQL database. 
    Also validates that referenced projects, people, and dependencies exist.
    Adds the tasks from the AI with the appropriate action type and approval set to False for the frontend 
    to display and allow the user to approve or reject.
    Prints to terminal of uvicorn for debugging purposes."""
    if not task_updates:
        return

    # Filter out schema-only fields before any database operations
    def extract_task_data(task_update: TaskUpdate) -> dict:
        task_data = task_update.model_dump(exclude_none=True)
        task_data.pop("project_name", None)
        task_data.pop("project_timezone", None)
        task_data.pop("discipline", None)
        return task_data

    task_names = [t.task_title for t in task_updates]
    existing_tasks = db.query(Task).filter(
        Task.task_title.in_(task_names)).all()
    existing_task_map = {task.task_title: task for task in existing_tasks}

    # Pre-load referenced projects and people for validation
    project_ids = {t.project_id for t in task_updates if t.project_id}
    owner_ids = {t.owner_id for t in task_updates if t.owner_id}

    existing_projects = db.query(Project).filter(
        Project.project_id.in_(project_ids)).all() if project_ids else []
    existing_project_map = {p.project_id: p for p in existing_projects}

    existing_people = db.query(Person).filter(
        Person.person_id.in_(owner_ids)).all() if owner_ids else []
    existing_person_map = {p.person_id: p for p in existing_people}

    update_drafts = []

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

        if existing_task:
            if task_update.action_type in ["new_task", "conflict_needs_clarification"]:
                final_action = "conflict_needs_clarification"
            else:
                final_action = "update"
        else:
            if task_update.action_type in ["update", "conflict_needs_clarification"]:
                final_action = "conflict_needs_clarification"
            else:
                final_action = "new_task"

        # If referenced entities are missing, escalate to conflict
        if not entities_valid:
            print(
                f"Referenced entities missing: project_exists={project_exists}, person_exists={person_exists}")
            final_action = "conflict_needs_clarification"

        print(f"Final action: {final_action}")

        try:
            task_data = extract_task_data(task_update)

            # Ensure task_id is never None (primary key requirement)
            if not task_data.get("task_id"):
                task_data["task_id"] = f"DRAFT_{uuid.uuid4().hex[:8].upper()}"
                print(f"Generated new task_id: {task_data['task_id']}")

            update_draft = Task(**task_data)
            update_draft.action_type = final_action  # type: ignore
            update_draft.is_approved = False  # type: ignore

            update_drafts.append(update_draft)
        except Exception as e:
            print(
                f"Error creating task draft for '{task_update.task_title}': {e}")
            continue

    if update_drafts:
        try:
            db.add_all(update_drafts)
            db.commit()
            print(f"Successfully committed {len(update_drafts)} task drafts.")
        except Exception as e:
            db.rollback()
            print(f"Error committing task drafts: {e}")
            raise
