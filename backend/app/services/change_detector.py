from contextvars import ContextVar
import json
import re
from typing import Any, Callable
import uuid

from agent_framework import tool
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Task
from app.schemas import TaskUpdate

StreamEmit = Callable[[dict[str, Any]], None]

# Query fragments only; blocks stacking / UNION / common SQL injections.
# Still quite naive
# Blocks injection patterns; AND/OR in normal WHERE clauses must stay allowed.
_BAD_SQL_FRAGMENT = re.compile(
    r"(?i)(;|\*/|/\*|\bunion\s+(all\s+)?select\b|\binto\s+(outfile|dumpfile)\b|\bload_file\b|\bxp_\w|\bsp_\w|\bpg_read_file\b|\bcopy\s*\(|\blimit\s+\(\s*select\b|\b(?:or|and)\b\s+(?:\d+|true|false)\s*=\s*(?:\d+|true|false)\b|\bselect\b\s+.*\s+from\b|\bdrop\b\s+table\b|\bupdate\b\s+.*\s+set\b|\bsleep\s*\(|\bwaitfor\s+delay\b)",
    re.IGNORECASE,
)

# Prefix → ``SELECT * FROM t <fragment>``; else fragment is ``SELECT <fragment> FROM t``.
_TAIL_PREFIXES = (
    "WHERE",
    "ORDER BY",
    "LIMIT",
    "OFFSET",
    "GROUP BY",
    "HAVING",
)

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


@tool(approval_mode="never_require", max_invocations=7)
def query_existing_tasks(
    query_str_tasks: str | None = None,
    query_str_projects: str | None = None,
    query_str_people: str | None = None,
    query_str_dependencies: str | None = None,
):
    """Read-only queries against tables (tasks, projects, people, dependencies).

    Tool name: ``query_existing_tasks``. Pass any non-empty ``query_str_*`` you need; omit the rest.
    One call can query several tables at once.

    **Projection:** only the select-list — e.g. ``*``, ``task_id, task_title``. Never put ``FROM`` here.

    **Tail (filters):** fragment starts with ``WHERE``, ``GROUP BY``, ``HAVING``, ``ORDER BY``, ``LIMIT``, or
    ``OFFSET``. The server runs ``SELECT * FROM <that_table> <fragment>``. You may also pass
    ``col1, col2, ... WHERE ...`` (column list followed by ``WHERE``; do not add ``FROM``). Multiple conditions with ``AND`` /
    ``OR`` are allowed. Example tails::

        WHERE project_id = 'P00001' AND task_id IN ('T00001','T00002')
        WHERE task_title ILIKE '%foundation%' ORDER BY task_id LIMIT 50

    In PostgreSQL put ``ORDER BY`` before ``LIMIT`` when using both.

    Returns JSON: ``{ "<table_name>": [ {column: value, …}, … ], … }``. Rejected fragments raise
    ``ValueError`` (e.g. ``;``, ``UNION``, block comments)."""
    specs = (
        ("tasks", "task_id", query_str_tasks),
        ("projects", "project_id", query_str_projects),
        ("people", "person_id", query_str_people),
        ("dependencies", "dependency_id", query_str_dependencies),
    )
    combined: dict[str, list[dict[str, Any]]] = {}
    with SessionLocal() as db:
        for table_sql, order_col, fragment in specs:
            if fragment is None or not str(fragment).strip():
                continue
            s = str(fragment).strip()
            bad_match = _BAD_SQL_FRAGMENT.search(s)
            if bad_match or "\x00" in s:
                raise ValueError(
                    "Disallowed characters or keywords in query fragment.")
            su = s.upper()
            if su.startswith(_TAIL_PREFIXES):
                q = f"SELECT * FROM {table_sql} {s}"
                if "ORDER BY" not in q.upper():
                    q = f"{q} ORDER BY {order_col}"
            elif re.search(r"\bWHERE\b", s, re.IGNORECASE):
                # Model often sends "col1, col2, ... WHERE ..." (columns then WHERE). Building
                # ``SELECT {s} FROM t`` would yield invalid ``SELECT cols WHERE ... FROM t``.
                m_where = re.search(r"\bWHERE\b", s, re.IGNORECASE)
                proj_part = s[: m_where.start()].strip()  # type: ignore
                tail_from_where = s[m_where.start():].strip()  # type: ignore
                if re.search(r"\bfrom\b", proj_part, re.IGNORECASE):
                    raise ValueError(
                        "Do not include FROM; use the table-specific argument.")
                select_list = proj_part if proj_part else "*"
                q = f"SELECT {select_list} FROM {table_sql} {tail_from_where}"
                if "ORDER BY" not in q.upper():
                    q = f"{q} ORDER BY {order_col}"
            else:
                if re.search(r"\bfrom\b", s, re.IGNORECASE):
                    raise ValueError(
                        "Do not include FROM; use the table-specific argument.")
                q = f"SELECT {s} FROM {table_sql} ORDER BY {order_col}"

            rows = db.execute(text(q)).mappings().all()
            combined[table_sql] = [dict(row) for row in rows]
            try_emit_progress(
                {"kind": "db", "table": table_sql,
                    "query": q, "rows": len(rows)}
            )

    if not combined:
        raise ValueError(
            "Provide at least one non-empty query_str_* (tasks, projects, people, dependencies)."
        )
    return json.dumps(combined, default=str, sort_keys=True)

def detect_changes_batched(db: Session, task_updates: list[TaskUpdate]):
    """Detects if the tasks caught by the AI are new, updates, or require clarification due to conflicts 
    based on the existing task data in Azure's PostgreSQL database. 
    Inserts new tasks or updates existing rows as unapproved tasks (drafts)."""
    if not task_updates:
        return

    # Filter out schema-only fields related to other tables before any operations on the table tasks
    def extract_task_data(task_update: TaskUpdate) -> dict:
        task_data = task_update.model_dump(exclude_none=True)
        task_data.pop("project_name", None)
        task_data.pop("project_timezone", None)
        task_data.pop("discipline", None)
        return task_data

    pending_rows: list[dict] = []
    task_columns = {c.key for c in Task.__table__.columns}

    for task_update in task_updates:
        try:
            task_data = extract_task_data(task_update)

            # Ensure task_id is never None (primary key requirement)
            if not task_data.get("task_id"):
                task_data["task_id"] = f"DRAFT_{uuid.uuid4().hex[:8].upper()}"

            task_data["is_approved"] = False
            pending_rows.append(task_data)
        except Exception:
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
    except Exception:
        db.rollback()
        raise
