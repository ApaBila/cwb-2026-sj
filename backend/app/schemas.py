from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import date


class TaskUpdate(BaseModel):
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    source_date_iso: Optional[date] = None
    project_timezone: Optional[str] = None

    task_id: Optional[str] = None
    task_title: Optional[str] = None

    discipline: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None

    # YYYY-MM-DD
    start_date_raw: Optional[str] = None
    planned_start: Optional[date] = None
    due_date_raw: Optional[str] = None
    planned_due: Optional[date] = None

    status: Literal["Not started", "In progress", "Blocked",
                    "Delayed", "Done", "Paused", "At risk", "Unknown"] = "Unknown"
    percent_complete: Optional[int] = Field(default=None, ge=0, le=100)
    priority: Literal["Low", "Medium", "High", "Critical"] = "Low"
    dependency: Optional[str] = None

    # [Categorical/Text] notes: Unique Values = { Client input required | Pending review | Awaiting info |  | Check dependencies }
    # [Categorical/Text] snapshot: Unique Values = { baseline | current }
    # [Categorical/Text] proposed_change: Unique Values = { Update due date for T00200 to 2026-03-24 | Update due date for T00550 to 2026-04-10 | Create new task linked to T00492 | Assign owner for T00071 to Mei Kaur | Create new task linked to T00103 | Update due date for T00531 to 2026-04-08 | ......
    source: Literal["chat_summary", "email_thread",
                    "meeting_notes"] = "meeting_notes"
    confidence: Literal["High", "Medium", "Low"] = "Low"
    action_type: Literal["new_task", "update",
                         "conflict_needs_clarification"] = "conflict_needs_clarification"

# [Categorical/Text] review_status: Unique Values = { Approved | Rejected | Pending }


class TaskUpdateList(BaseModel):
    tasks: List[TaskUpdate]


class UpdateRequest(BaseModel):
    user_text: str = Field()


class WorkflowExecutionResponse(BaseModel):
    turns: int
    # key_findings: str = Field(
    #     description="Key findings include: unknowns and uncertainties that the detail extractor agent found, change detection agent's help with those and anything else, and finally how the details agent changed their answer based on the change detection agent's feedback for that issue.")
    concise_chat: List[str] = Field(
        description="""Replay the conversation between the detail extractor agent and change detection agent but edit to keep short,  simple, and clear. Use this format: \nTurn {#}: {agent_name}: {their response}""")


class CommitUpdate(BaseModel):
    task_ids: List[str] = Field(min_length=1)
