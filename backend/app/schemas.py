from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import date


class TaskUpdate(BaseModel):
    project: str = "Unspecified"
    source_date_iso: Optional[date] = None
    project_timezone: str = "Unspecified"

    task: str = "Unspecified"
    owner: Optional[str] = None
    due_date_raw: Optional[str] = None
    due_date_iso: Optional[date] = None

    status: Literal["Not Started", "In Progress", "Blocked",
                    "Delayed", "Done", "Paused", "At Risk", "Unknown"]

    dependency: Optional[str] = None

    source: Optional[str] = None
    confidence: Literal["High", "Medium", "Low"]

    action_type: Literal["new_task", "update", "conflict_needs_clarification"]


class TaskUpdateList(BaseModel):
    tasks: List[TaskUpdate]


class UpdateRequest(BaseModel):
    user_text: str = Field()
    no_ai: bool = Field(
        default=False, description="Set True for dev mode, no AI to save Azure credits")
