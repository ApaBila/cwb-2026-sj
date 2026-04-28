from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import date


class TaskUpdate(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = "Unspecified"
    source_date_iso: Optional[date] = None
    project_timezone: str = "Unspecified"

    task_id: Optional[str] = None
    task_title: str = "Unspecified"

    discipline: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None

    # YYYY-MM-DD
    start_date_raw: Optional[str] = None
    planned_start: Optional[date] = None
    due_date_raw: Optional[str] = None
    planned_due: Optional[date] = None

    status: Literal["Not started", "In progress", "Blocked",
                    "Delayed", "Done", "Paused", "At risk", "Unknown"]
    percent_complete: Optional[int] = Field(default=None, ge=0, le=100)
    priority: Literal["Low", "Medium", "High", "Critical"] = "Low"
    dependency: Optional[str] = None

    # [Categorical/Text] notes: Unique Values = { Client input required | Pending review | Awaiting info |  | Check dependencies }
    # [Categorical/Text] snapshot: Unique Values = { baseline | current }
    # [Categorical/Text] proposed_change: Unique Values = { Update due date for T00200 to 2026-03-24 | Update due date for T00550 to 2026-04-10 | Create new task linked to T00492 | Assign owner for T00071 to Mei Kaur | Create new task linked to T00103 | Update due date for T00531 to 2026-04-08 | ......
    source: Literal["chat_summary", "email_thread",
                    "meeting_notes"]
    confidence: Literal["High", "Medium", "Low"] = "Low"
    action_type: Literal["new_task", "update",
                         "conflict_needs_clarification"]

# [Categorical/Text] review_status: Unique Values = { Approved | Rejected | Pending }


class TaskUpdateList(BaseModel):
    tasks: List[TaskUpdate]


class UpdateRequest(BaseModel):
    user_text: str = Field()
    no_ai: bool = Field(
        default=False, description="Set True for dev mode, no AI to save Azure credits")


class CommitUpdate(BaseModel):
    task_ids: List[int] = Field(min_length=1)
