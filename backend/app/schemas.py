from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import date


class TaskUpdate(BaseModel):
    # discipline: Unique Values = { PMO | MEP | Digital | Civil | Sustainability | Architecture | Cost | Structural }
    # [Categorical/Text] owner_id: Unique Values = { P005 | P012 | P008 | P015 | P004 | P003 | P016 | P002 | P018 | P009 | P017 | P010 | P006 | P001 | P013 | P011 | P014 | P007 }
    # [Categorical/Text] owner_name: Unique Values = { Aisha Kaur | Ivy Santos | Ivy Chung | Farah Singh | Lina Ong | Grace Kaur | Anika Chen | Aisha Ong | Rina Ali | Lina Singh | Chloe Lee | Lina Tan | Grace Santos | Sofia Ong | Mei Rahman | Sofia Singh | Chloe Ng | Maya Wong }
    # [Categorical/Text] priority: Unique Values = { Low | Medium | High | Critical }
    # [Categorical/Text] notes: Unique Values = { Client input required | Pending review | Awaiting info |  | Check dependencies }
    # [Categorical/Text] snapshot: Unique Values = { baseline | current }
    # [Categorical/Text] proposed_change: Unique Values = { Update due date for T00200 to 2026-03-24 | Update due date for T00550 to 2026-04-10 | Create new task linked to T00492 | Assign owner for T00071 to Mei Kaur | Create new task linked to T00103 | Update due date for T00531 to 2026-04-08 | ......

    project_id: Optional[int] = None
    project_name: str = "Unspecified"
    source_date_iso: Optional[date] = None
    project_timezone: str = "Unspecified"

    task_id: Optional[int] = None
    task: str = "Unspecified"
    owner: Optional[str] = None
    # YYYY-MM-DD
    start_date_raw: Optional[str] = None
    planned_start: Optional[date] = None
    due_date_raw: Optional[str] = None
    planned_due: Optional[date] = None

    status: Literal["Not started", "In progress", "Blocked",
                    "Delayed", "Done", "Paused", "At risk", "Unknown"]
    percent_complete: Optional[int] = Field(default=None, ge=0, le=100)
    dependency: Optional[str] = None

    source: Optional[str] = None
    confidence: Literal["High", "Medium", "Low"]

    action_type: Literal["new_task", "update", "conflict_needs_clarification"]

# [Categorical/Text] source: Unique Values = { chat_summary | email_thread | meeting_notes }
# [Categorical/Text] confidence: Unique Values = { Low | Medium }
# [Categorical/Text] review_status: Unique Values = { Approved | Rejected | Pending }


class TaskUpdateList(BaseModel):
    tasks: List[TaskUpdate]


class UpdateRequest(BaseModel):
    user_text: str = Field()
    no_ai: bool = Field(
        default=False, description="Set True for dev mode, no AI to save Azure credits")


class CommitUpdate(BaseModel):
    task_ids: List[int] = Field(min_length=1)
