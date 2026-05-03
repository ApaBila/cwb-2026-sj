import os
import uuid
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from app.schemas import TaskUpdateList, TaskUpdate
from app.services.change_detector import query_existing_tasks

client = FoundryChatClient(
    project_endpoint=os.getenv(
        "FOUNDRY_PROJECT_ENDPOINT",
        "https://cwb-sj-planner.services.ai.azure.com/api/projects/cwb-sj-planner",
    ),
    model=os.getenv("FOUNDRY_MODEL", "gpt-4.1-mini-1"),
    credential=DefaultAzureCredential(),
)

updater_agent = Agent(
    client=client,
    name="SJ-Update-Agent",
    instructions="""
    You are the SJ Task Updater Agent. 
    Analyze unstructured meeting notes, emails, and conversations, to form structured task updates.
    Based on the change_detection agent queries to the database, you may change your answers. 
    """,
)

change_detection_agent = Agent(
    client=client,
    name="SJ-Change-Detection-Agent",
    tools=[query_existing_tasks],
    instructions="""
    You are the SJ Task Change Detection Agent.
    You are a meticulous SQL expert.
    You will take the response from the updater_agent and run multiple queries on the database to determine if each task is new or not or if human clarification is needed.
    You can use as many queries as needed. Not catching a previous task is much worse than taking a long time or falsely identifying a task when you could mark it for conflict.
    Remember to try fuzzy searches. Remember to try to find similar tasks, projects, people across dependencies.
    Your succinct output will be used by the final agent, the formatter agent, to determine how to polish or fix the updater_agent's response.
    """
)

formatter_agent = Agent(
    client=client,
    name="SJ-Formatter-Agent",
    instructions="""
    You are the SJ Task Formatter Agent. 
    You will rely on your fellow agents previous responses to format the final output into the TaskUpdateList schema that the frontend expects, with the best values possible.
    Pay attention to confidence and action_type.
    """,
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

    update_response = await updater_agent.run(
        text,
        options={"response_format": TaskUpdateList}
    )
    print("Updater Agent Response:", update_response.text)
    detection_response = await change_detection_agent.run(
        f"Input: {text}\nUpdater Agent Response: {update_response}"
    )
    print("Change Detection Agent Response:", detection_response.text)
    formatter_response = await formatter_agent.run(
        f"Input: {text}\nUpdater Agent Response: {update_response}\nChange Detection Agent Response: {detection_response}",
        options={"response_format": TaskUpdateList}
    )
    return formatter_response.value
