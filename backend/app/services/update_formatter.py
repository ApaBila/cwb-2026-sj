import uuid
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

from app.schemas import TaskUpdateList, TaskUpdate
from app.services.change_detector import query_existing_tasks

client = FoundryChatClient(
    project_endpoint="https://cwb-sj-planner.services.ai.azure.com/api/projects/cwb-sj-planner",
    model="gpt-4.1-mini-1",
    credential=AzureCliCredential(),
)

agent = Agent(
    client=client,
    name="SJ-Update-Formatter-Agent",
    tools=[query_existing_tasks],
    instructions="""
    You are the SJ Project Task Updater Agent. 
    Analyze unstructured meeting notes, emails, and conversations, to form structured task updates.
    You can use the query tool to determine whether the task already exists.
    """
)


async def format_update(text: str, no_ai: bool = False):
    if no_ai:
        # Generate unique task_id for each draft to avoid primary key conflicts
        draft_task_id = f"DRAFT_{uuid.uuid4().hex[:8].upper()}"
        return TaskUpdateList(
            tasks=[
                TaskUpdate(
                    project_id=None,
                    project_name="Unspecified",
                    project_timezone="Unspecified",
                    source_date_iso=None,
                    task_id=draft_task_id,
                    task_title="[DRAFT] Sample Task",
                    discipline=None,
                    owner_id=None,
                    owner_name=None,
                    start_date_raw=None,
                    planned_start=None,
                    due_date_raw=None,
                    planned_due=None,
                    status="Unknown",
                    percent_complete=None,
                    priority="Low",
                    dependency=None,
                    source="meeting_notes",
                    confidence="Low",
                    action_type="conflict_needs_clarification",
                )
            ]
        )

    response = await agent.run(
        text,
        options={"response_format": TaskUpdateList}
    )
    return response.value
