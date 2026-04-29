from sqlalchemy.orm import Session
from ..models import Task
from ..schemas import TaskUpdate


def detect_changes_batched(db: Session, task_updates: list[TaskUpdate]):
    """Detects if the tasks caught by the AI are new, updates, or require clarification due to conflicts 
    based on the existing task data in Azure's PostgreSQL database. 
    Adds the tasks from the AI with the appropriate action type and approval set to False for the frontend 
    to display and allow the user to approve or reject.
    Prints to terminal of uvicorn for debugging purposes."""
    task_names = [t.task_title for t in task_updates]
    existing_tasks = db.query(Task).filter(
        Task.task_title.in_(task_names)).all()
    existing_task_map = {task.task_title: task for task in existing_tasks}

    update_drafts = []

    for task_update in task_updates:
        print("Detecting changes for task:", task_update.task_title)
        print("Action type from AI:", task_update.action_type)

        existing_task = existing_task_map.get(
            task_update.task_title)  # type: ignore

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

        print(final_action)

        update_draft = Task(
            **task_update.model_dump(exclude_none=True)
        )

        update_draft.action_type = final_action  # type: ignore
        update_draft.is_approved = False  # type: ignore

        update_drafts.append(update_draft)

    if update_drafts:
        db.add_all(update_drafts)
        db.commit()
