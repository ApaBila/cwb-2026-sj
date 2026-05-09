import asyncio
import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .database import SessionLocal
from .services.update_formatter import format_update
from .schemas import UpdateRequest
from openai import APIStatusError
from .services.change_detector import detect_changes_batched, stream_progress_emit
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


def _encode_sse(event_name: str, data: dict) -> bytes:
    return (
        f"event: {event_name}\n"
        f"data: {json.dumps(data, default=str)}\n\n"
    ).encode("utf-8")


@app.post("/api/drafts/create/stream")
async def post_drafts_stream(request_text: UpdateRequest):
    """Same outcome as POST /api/drafts/create, but streams SSE progress events."""

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def emit_progress(payload: dict) -> None:
        def put() -> None:
            try:
                queue.put_nowait(("progress", payload))
            except Exception:
                pass

        loop.call_soon_threadsafe(put)

    async def event_gen():
        async def worker() -> None:
            token = stream_progress_emit.set(emit_progress)
            try:
                emit_progress({"kind": "status", "phase": "starting"})
                user_text = request_text.user_text
                no_ai = os.getenv("SJ_NO_AI", "").strip(
                ).lower() in ("1", "true", "yes")
                emit_progress({"kind": "status", "phase": "formatting"})
                ai_response = await format_update(user_text, no_ai=no_ai)
                emit_progress({"kind": "status", "phase": "writing_drafts"})
                with SessionLocal() as db:
                    detect_changes_batched(db, ai_response.tasks)  # type: ignore
                emit_progress({"kind": "status", "phase": "done"})
                dump = ai_response.model_dump(mode="json")  # type: ignore
                await queue.put(("final", dump))
            except APIStatusError as e:
                await queue.put(("error", {"detail": e.message}))
            except Exception as e:
                await queue.put(("error", {"detail": str(e)}))
            finally:
                stream_progress_emit.reset(token)
                await queue.put(("end", None))

        asyncio.create_task(worker())
        while True:
            kind, data = await queue.get()
            if kind == "progress":
                yield _encode_sse("progress", data)
            elif kind == "final":
                yield _encode_sse("final", data)
            elif kind == "error":
                yield _encode_sse("error", data)
                break
            elif kind == "end":
                break

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
