from sqlalchemy.orm import Session
from ..models import Task
from ..schemas import TaskUpdate


def detect_change(db: Session, task_update: TaskUpdate):
    """Detects if the tasks caught by the AI are new, updates, or require 
    clarification due to conflicts based on the existing task data in Azure's PostgreSQL database.
    Prints to terminal of uvicorn for debugging purposes."""
    print("Detecting changes for task:", task_update.task)
    print("Action type from AI:", task_update.action_type)

    existing_task = db.query(Task).filter(
        Task.task == task_update.task).first()

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
