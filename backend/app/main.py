import asyncio
from datetime import date
import json
import os
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import APIStatusError
from sqlalchemy import or_, text, update
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Dependency, Task
from .schemas import CommitUpdate, UpdateRequest
from .services.change_detector import (
    clear_stream_progress_fallback,
    set_stream_progress_fallback,
    stream_progress_emit,
)
from .services.update_formatter import (
    DRAFT_ID_SUFFIX,
    base_task_id_from_draft_row_id,
    format_update,
)

app = FastAPI(title="SJ Project Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API struct

# drafts (unaccepted tasks)
# - POST /create to send to AI then add formatted version to task database as a draft
# - GET to view for approval
# - POST /accept to delete old task if exists and change draft to official task
# - DELETE to discard draft and delete from tasks table

# (official) tasks
# - GET to view for Gantt chart

# drafts/(official) tasks are both Task objects


def _delete_tasks_cascade_dependencies(db: Session, task_ids: list[str]) -> None:
    """Remove dependency rows touching these task ids, then delete the tasks."""
    if not task_ids:
        return
    db.query(Dependency).filter(
        or_(
            Dependency.predecessor_task_id.in_(task_ids),
            Dependency.successor_task_id.in_(task_ids),
        )
    ).delete(synchronize_session=False)
    db.query(Task).filter(Task.task_id.in_(task_ids)).delete(
        synchronize_session=False)


def _max_canonical_task_numeric(db: Session) -> int:
    """Largest ``T#####`` numeric suffix in ``tasks.task_id`` (global across projects)."""
    max_n = 0
    for (tid,) in db.query(Task.task_id).all():
        m = re.fullmatch(r"T(\d+)", tid)
        if m:
            max_n = max(max_n, int(m.group(1)))
    return max_n


def _format_canonical_task_id(n: int) -> str:
    return f"T{n:05d}"


_CHANGELOG_SKIP_COLS = frozenset(
    {"task_id", "is_approved", "confidence", "action_type"}
)


def _task_changelog_diff(base: Task, draft: Task) -> list[dict]:
    """Pairs of column names with differing base vs draft values (skip ids / approval flag)."""
    out: list[dict] = []
    for col in Task.__table__.columns:
        key = col.key
        if key in _CHANGELOG_SKIP_COLS:
            continue
        b = getattr(base, key)
        d = getattr(draft, key)
        if b == d:
            continue
        out.append(
            {
                "column": key,
                "base": b.isoformat() if isinstance(b, date) else b,
                "draft": d.isoformat() if isinstance(d, date) else d,
            }
        )
    return out


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
    # with SessionLocal() as db:
    #     detect_changes_batched(db, ai_response.tasks)  # type: ignore

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
            set_stream_progress_fallback(emit_progress)
            try:
                emit_progress({"kind": "status", "phase": "starting"})
                user_text = request_text.user_text
                no_ai = os.getenv("SJ_NO_AI", "").strip(
                ).lower() in ("1", "true", "yes")
                emit_progress({"kind": "status", "phase": "formatting"})
                ai_response = await format_update(user_text, no_ai=no_ai)
                emit_progress({"kind": "status", "phase": "writing_drafts"})
                emit_progress({"kind": "status", "phase": "done"})
                dump = ai_response.model_dump(mode="json")  # type: ignore
                await queue.put(("final", dump))
            except APIStatusError as e:
                await queue.put(("error", {"detail": e.message}))
            except Exception as e:
                await queue.put(("error", {"detail": str(e)}))
            finally:
                clear_stream_progress_fallback()
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


@app.post("/api/drafts/changelog")
async def post_drafts_changelog(body: CommitUpdate):
    """Diff approved baseline rows vs draft rows for selected *_draft task ids (changed columns only)."""
    task_ids = list(
        dict.fromkeys(
            str(t).strip() for t in body.task_ids if str(t).strip()
        )
    )
    bad = [x for x in task_ids if not x.endswith(DRAFT_ID_SUFFIX)]
    if bad:
        raise HTTPException(
            status_code=400,
            detail=f"Only draft task ids (ending with {DRAFT_ID_SUFFIX!r}) are allowed: {sorted(bad)}",
        )
    with SessionLocal() as db:
        items: list[dict] = []
        drafts = db.query(Task).filter(Task.task_id.in_(task_ids)).all()
        by_id = {t.task_id: t for t in drafts}
        missing = set(task_ids) - set(by_id)  # type: ignore
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Task IDs not found: {sorted(missing)}",
            )
        if any(bool(t.is_approved) for t in drafts):
            raise HTTPException(
                status_code=400,
                detail="Changelog is only for draft (unapproved) rows.",
            )
        for did in task_ids:
            draft = by_id[did]  # type: ignore
            base_id = base_task_id_from_draft_row_id(did)
            base = (
                db.query(Task)
                .filter(
                    Task.task_id == base_id,
                    Task.is_approved.is_(True),
                )
                .first()
            )
            if base is None:
                items.append(
                    {
                        "draft_task_id": did,
                        "base_task_id": None,
                        "task_title": draft.task_title,
                        "project_id": draft.project_id,
                        "changes": [],
                    }
                )
                continue
            items.append(
                {
                    "draft_task_id": did,
                    "base_task_id": base_id,
                    "task_title": draft.task_title,
                    "project_id": draft.project_id,
                    "changes": _task_changelog_diff(base, draft),
                }
            )
        return {"items": items}


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
            _delete_tasks_cascade_dependencies(db, id_list)  # type: ignore

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


@app.post("/api/drafts/approve")
async def post_tasks(request_text: CommitUpdate):
    """Permanently approve selected rows."""
    # TODO: add dependency creation
    task_ids = list(
        dict.fromkeys(
            str(task_id).strip()
            for task_id in request_text.task_ids
            if str(task_id).strip()
        )
    )
    not_drafts = [tid for tid in task_ids if not tid.endswith(DRAFT_ID_SUFFIX)]
    if not_drafts:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft task ids (ending with "
                f"{DRAFT_ID_SUFFIX!r}) can be approved. "
                f"Invalid: {sorted(not_drafts)}"
            ),
        )

    with SessionLocal() as db:
        try:
            drafts = db.query(Task).filter(Task.task_id.in_(task_ids)).all()
            found_ids = {t.task_id for t in drafts}
            missing = set(task_ids) - found_ids  # type: ignore
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Task IDs not found: {sorted(missing)}. Try refreshing.",
                )
            if any(bool(t.is_approved) for t in drafts):
                raise HTTPException(
                    status_code=400,
                    detail="One or more tasks are already approved.",
                )

            bases = [base_task_id_from_draft_row_id(tid) for tid in task_ids]
            approved_bases = {
                row[0]
                for row in db.query(Task.task_id)
                .filter(
                    Task.task_id.in_(bases),
                    Task.is_approved.is_(True),
                )
                .all()
            }

            update_pairs: list[tuple[str, str]] = []
            new_pairs: list[tuple[str, str]] = []
            for tid in task_ids:
                base = base_task_id_from_draft_row_id(tid)
                if base in approved_bases:
                    update_pairs.append((tid, base))
                else:
                    new_pairs.append((tid, base))

            if update_pairs:
                delete_ids = list({b for _, b in update_pairs})
                _delete_tasks_cascade_dependencies(db, delete_ids)
                for draft_id, base in update_pairs:
                    db.execute(
                        update(Task)
                        .where(Task.task_id == draft_id)
                        .values(task_id=base, is_approved=True)
                    )

            db.flush()

            if new_pairs:
                next_n = _max_canonical_task_numeric(db) + 1
                for i, (draft_id, _) in enumerate(new_pairs):
                    new_id = _format_canonical_task_id(next_n + i)
                    db.execute(
                        update(Task)
                        .where(Task.task_id == draft_id)
                        .values(task_id=new_id, is_approved=True)
                    )

            db.commit()

            return {
                "status": "success",
                "message": (
                    f"Approved {len(task_ids)} task(s) "
                    f"({len(update_pairs)} update(s), {len(new_pairs)} new)."
                ),
            }
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
