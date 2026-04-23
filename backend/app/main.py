from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .services.spec_catcher import catch_spec
import json
from .schemas import TaskUpdateList, UpdateRequest
from openai import APIStatusError
from .database import SessionLocal
from .services.change_detector import detect_changes_batched
from sqlalchemy import text
from .schemas import CommitUpdate
from .models import Task

app = FastAPI(title="SJ Project Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_status():
    """Checks if we can connect to the database"""
    with SessionLocal() as db:
        try:
            db.execute(text("SELECT 1"))  # type: ignore
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Database connection failed: {str(e)}")
    return {"status": "online", "message": "SJ Planner Backend is running"}


@app.post("/api/project-update")
async def project_update(request_text: UpdateRequest):
    user_text = request_text.user_text

    try:
        ai_response = catch_spec(user_text, no_ai=request_text.no_ai)

        try:
            raw_response = json.loads(ai_response)  # type: ignore
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500, detail="AI did not return valid JSON.")
        try:
            validated_response = TaskUpdateList(**raw_response)
        except APIStatusError as e:
            raise HTTPException(
                status_code=e.status_code,
                detail=e.message
            )
        # Check action types for all tasks and detect changes
        with SessionLocal() as db:
            detect_changes_batched(db, validated_response.tasks)

        return validated_response.model_dump(mode='json')
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing the request: {str(e)}")


@app.get("/api/drafts")
async def get_drafts():
    with SessionLocal() as db:
        results = db.execute(
            text("SELECT * FROM tasks WHERE is_approved = false")).mappings()
        drafts = {result["id"]: dict(result) for result in results}
    return drafts


@app.put("/api/commit")
async def commit_updates(request_text: CommitUpdate):
    task_ids = request_text.task_ids
    with SessionLocal() as db:
        try:
            tasks_to_commit = db.query(Task).filter(Task.id.in_(task_ids))

            if not tasks_to_commit.all():
                raise HTTPException(
                    status_code=404, detail="No tasks found for those IDs. Try refreshing.")

            for task in tasks_to_commit:
                task.is_approved = True  # type: ignore

            db.commit()

            return {"status": "success", "message": f"Committed {len(task_ids)} tasks."}
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500, detail=f"Error committing tasks: {str(e)}")
