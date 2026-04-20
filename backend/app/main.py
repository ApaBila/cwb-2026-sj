from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .services.spec_catcher import catch_spec
import json
from .schemas import TaskUpdateList, UpdateRequest
from openai import APIStatusError
from .database import SessionLocal
from .services.change_detector import detect_changes_batched
from sqlalchemy import text

app = FastAPI(title="SJ Project Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
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
