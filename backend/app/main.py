import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import SessionLocal
from .services.update_formatter import format_update
from .schemas import UpdateRequest
from openai import APIStatusError
from .services.change_detector import detect_changes_batched
from sqlalchemy import text, or_
from .schemas import CommitUpdate
from .models import Task, Dependency
from datetime import date

app = FastAPI(title="SJ Project Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API struct
# drafts (unapproved tasks)
# - POST to send to AI then add formatted version to task database as a draft
# - GET to view for approval
# - PATCH to approve, flip is_approve flag so it'll be considered (official) tasks
# - DELETE to reject and remove draft from tasks and dependencies
# (official) tasks
# - GET to view for Gantt chart
# TODO: allow editing official tasks

# drafts/(official) tasks are both Task objects


@app.get("/")
def health_status():
    """Checks if we can connect to the database"""
    with SessionLocal() as db:
        try:
            db.execute(text("SELECT 1"))  # type: ignore
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"""Database connection failed: {str(e)}.
                Try checking database networking settings.""")
    return {"status": "online", "message": "SJ Planner Backend is running"}


@app.post("/api/drafts/create")
async def post_drafts(request_text: UpdateRequest):
    # TODO: add dependency creation
    user_text = request_text.user_text

    try:
        no_ai = os.getenv("SJ_NO_AI", "").strip(
        ).lower() in ("1", "true", "yes")
        ai_response = await format_update(user_text, no_ai=no_ai)
        print(ai_response)
    except APIStatusError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message
        )
    # Check action types for all tasks and detect changes
    with SessionLocal() as db:
        detect_changes_batched(db, ai_response.tasks)  # type: ignore

    return ai_response.model_dump(mode='json')  # type: ignore


@app.get("/api/drafts")
async def get_drafts():
    """Get all unapproved tasks aka drafts."""
    with SessionLocal() as db:
        results = db.execute(
            text("SELECT * FROM tasks WHERE is_approved = false")).mappings()
    return [dict(result) for result in results]


@app.delete("/api/drafts/reject")
async def delete_drafts(request_text: CommitUpdate):
    """Permanently delete selected rows that are still drafts (not approved task updates)."""
    task_ids = [str(task_id).strip()
                for task_id in request_text.task_ids if str(task_id).strip()]
    with SessionLocal() as db:
        try:
            tasks = db.query(Task).filter(Task.task_id.in_(task_ids)).all()
            found_ids = {t.task_id for t in tasks}
            missing = set(task_ids) - found_ids  # type: ignore
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Task IDs not found: {sorted(missing)}. Try refreshing.",
                )
            if any(bool(t.is_approved) for t in tasks):
                raise HTTPException(
                    status_code=400,
                    detail="One or more tasks are already approved and cannot be rejected.",
                )

            id_list = list(found_ids)
            db.query(Dependency).filter(
                or_(
                    Dependency.predecessor_task_id.in_(id_list),
                    Dependency.successor_task_id.in_(id_list),
                )
            ).delete(synchronize_session=False)

            db.query(Task).filter(Task.task_id.in_(id_list)).delete(
                synchronize_session=False)

            db.commit()
            return {
                "status": "success",
                "message": f"Removed {len(id_list)} draft(s) from the queue.",
            }
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Error rejecting drafts: {str(e)}",
            )


@app.patch("/api/drafts/approve")
async def patch_drafts(request_text: CommitUpdate):
    """Permanently approve selected rows."""
    # TODO: add dependency creation
    task_ids = [str(task_id).strip()
                for task_id in request_text.task_ids if str(task_id).strip()]
    with SessionLocal() as db:
        try:
            tasks_to_approve = db.query(Task).filter(
                Task.task_id.in_(task_ids)).all()
            found_ids = {t.task_id for t in tasks_to_approve}
            missing = set(task_ids) - found_ids  # type: ignore
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Task IDs not found: {sorted(missing)}. Try refreshing.",
                )

            for task in tasks_to_approve:
                task.is_approved = True  # type: ignore

            db.commit()

            return {"status": "success", "message": f"Approved {len(tasks_to_approve)} tasks."}
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Error committing tasks: {str(e)}")


@app.get("/api/tasks")
def get_tasks():
    """get all approved updates aka tasks. also get their dependencies"""
    with SessionLocal() as db:
        try:
            tasks = db.query(Task).filter(Task.is_approved == True).all()
            # TODO: think about whether succcesors as well would be clutter
            deps = db.query(Dependency).filter(
                Dependency.successor_task_id.in_([t.task_id for t in tasks])).all()
            predecessor_map = {}
            for d in deps:
                predecessor_map.setdefault(d.successor_task_id, []).append(
                    d.predecessor_task_id
                )
            out = []
            for t in tasks:
                task_data = {}
                for col in t.__table__.columns:
                    val = getattr(t, col.name)
                    task_data[col.name] = val.isoformat(
                    ) if isinstance(val, date) else val
                task_data["dependencies"] = predecessor_map.get(t.task_id, [])
                out.append(task_data)
            return out
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
