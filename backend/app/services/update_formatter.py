import os
import uuid
from agent_framework import Agent, AgentResponseUpdate, WorkflowBuilder
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from app.schemas import TaskUpdateList, TaskUpdate
from app.services.change_detector import query_existing_tasks

import json
from agent_framework import tool
from app.models import Task, Project, Person

# https://github.com/microsoft/agent-framework/blob/main/python/samples/03-workflows/agents/azure_ai_agents_streaming.py

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
    instructions=f"""
    You are the SJ Group Task Updater Agent.
    Analyze unstructured meeting notes, emails, and conversations, to form structured task updates.
    The final formatting will be done by the formatter agent, a list of {json.dumps(TaskUpdate.model_json_schema(), indent=2)}.
    Change your answers as needed based on the change detection agent queries to the database.
    Highlight uncertainties for succeeding agents.
    Note clearly when you've exhausted your resources and are making a final attempt.
    """,
)

change_detection_agent = Agent(
    client=client,
    name="SJ-Change-Detection-Agent",
    tools=[query_existing_tasks],
    instructions=f"""
    You are the SJ Group Task Change Detection Agent.
    You are a meticulous SQL expert.
    You will take the response from the updater agent and run multiple queries on the database to determine if each task is new, or if it's not what are the updates, and if human clarification is needed.
    You should note your uncertainties so succeeding agents can adjust overall confidence accordingly.
    This is the tool you will be using:
    @tool(approval_mode="never_require", max_invocations=7)
        def query_existing_tasks(query_str: str):
            "Tool function to query the database.
            Must be one query that starts with SELECT.
            This can be used by the AI agent to compare against incoming task updates for change detection.
            All tables can be queried, including tasks, projects, people, dependencies.""
            if not query_str.strip().upper().startswith("SELECT"):
                raise ValueError("Only SELECT queries are allowed")
            if ";" in query_str.strip().rstrip(";"):
                raise ValueError("Only one query at a time is allowed")
            with SessionLocal() as db:
                result = db.execute(text(query_str)).all()
            return json.dumps([dict(row) for row in result], default=str)
    You should start broadly to understand the current state of the database, what are ids like, what are naming conventions, who usually works on what tasks.
    You should find similar tasks, projects, people.
    Remember to use fuzzy searches because natural language allows the same thing to be said in many ways.
    Use wildcards and partial matches etc.
    You can use as many queries as needed. Not catching a previous task is much worse than taking a long time or falsely identifying a task when you could mark it for conflict.
    These are the table models you can query:
    {json.dumps({"Tasks": Task.__table__.columns.keys(), "Projects": Project.__table__.columns.keys(), "People": Person.__table__.columns.keys()}, indent=2)}
    Your succinct output will be used by the updater agent to adjust their response and by the formatter agent to format the final response.
    Note when you've believed you've exhausted your resources so the updater agent makes it's final attempt.
    No need to respond to the updater agent's final attempt.
    """
)

workflow = WorkflowBuilder(start_executor=updater_agent).add_edge(
    updater_agent, change_detection_agent).build()


@tool(approval_mode="never_require", max_invocations=3)
async def workflow_execution(workflow_text: str) -> str:
    last_worker: str | None = None
    events = workflow.run(workflow_text, stream=True)
    responses = []
    async for event in events:
        if event.type == "output" and isinstance(event.data, AgentResponseUpdate):
            update = event.data
            author = update.author_name
            if author != last_worker:
                if last_worker is not None:
                    print()  # Newline between different workers
                print(f"{author}: {update.text}", end="", flush=True)
                responses.append(f"{author}: {update.text}")
                last_worker = author
            else:
                print(update.text, end="", flush=True)
                responses[-1] += f"{update.text}"

    if responses:
        return f"""{responses}"""
    else:
        return "Workflow didn't work."


workflow_executor = Agent(
    client=client,
    name="SJ-Workflow-Executor-Agent",
    tools=[workflow_execution],
    instructions=f"""
    You are the SJ Group Task Workflow Executor Agent.
    You will execute the workflow between the updater agent and change detection agent.
    If you think they're done or stuck, end the workflow.
    Final response should be an editorialized version of their conversation for the formatter agent to use,
    whose job is to format the final respones into the following schema for the database:  {json.dumps(TaskUpdate.model_json_schema(), indent=2)}.
    """
)

formatter_agent = Agent(
    client=client,
    name="SJ-Formatter-Agent",
    instructions="""
    You are the SJ Group Task Formatter Agent.
    You must use your fellow agents previous responses to format the final output into the TaskUpdateList schema that the frontend expects, with the best values possible.
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

    workflow_executor_response = await workflow_executor.run(text)

    formatter_response = await formatter_agent.run(
        f"""User Input: {text}\n
        Agent Discussion: {workflow_executor_response}\n
        Format the response into the TaskUpdateList schema.""",
        options={"response_format": TaskUpdateList}
    )
    return formatter_response.value
