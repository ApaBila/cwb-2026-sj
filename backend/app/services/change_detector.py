from sqlalchemy.orm import Session
from ..models import Task
from ..schemas import TaskUpdate


def detect_changes_batched(db: Session, task_updates: list[TaskUpdate]):
    """Detects if the tasks caught by the AI are new, updates, or require 
    clarification due to conflicts based on the existing task data in Azure's PostgreSQL database.
    Prints to terminal of uvicorn for debugging purposes."""
    task_names = [t.task for t in task_updates]
    existing_tasks = db.query(Task).filter(Task.task.in_(task_names)).all()
    existing_task_map = {task.task: task for task in existing_tasks}

    for task_update in task_updates:
        print("Detecting changes for task:", task_update.task)
        print("Action type from AI:", task_update.action_type)

        existing_task = existing_task_map.get(task_update.task)

        if existing_task:
            if task_update.action_type in ["new_task", "conflict_needs_clarification"]:
                task_update.action_type = "conflict_needs_clarification"
            else:
                task_update.action_type = "update"
        else:
            if task_update.action_type in ["update", "conflict_needs_clarification"]:
                task_update.action_type = "conflict_needs_clarification"
            else:
                task_update.action_type = "new_task"

        print(task_update.action_type)
