import os
import uuid
from agent_framework import Agent, AgentResponseUpdate, WorkflowBuilder
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from app.schemas import TaskUpdateList, TaskUpdate
from app.services.change_detector import query_existing_tasks


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
    workflow = WorkflowBuilder(start_executor=updater_agent).add_edge(
        updater_agent, change_detection_agent).build()

    async def workflow_execution(workflow_text: str) -> str:
        last_worker: str | None = None
        events = workflow.run(workflow_text, stream=True)
        async for event in events:
            if event.type == "output" and isinstance(event.data, AgentResponseUpdate):
                update = event.data
                author = update.author_name
                if author != last_worker:
                    if last_worker is not None:
                        print()  # Newline between different workers
                    print(f"{author}: {update.text}", end="", flush=True)
                    last_worker = author
                else:
                    print(update.text, end="", flush=True)

        final_result = await events.get_final_response()
        final_response = final_result.get_outputs()
        if final_response:
            return f"""{final_response[-1].text}: {final_response[-1].text}"""
        else:
            return "Workflow didn't work."

    rounds = []
    for round in range(2):
        if round == 0:
            workflow_result = await workflow_execution(text)
        else:
            workflow_result = await workflow_execution(f"{text}{rounds}")
        rounds.append(workflow_result)

    # update_response = await updater_agent.run(
    #     text,
    # )
    # print("Updater Agent Response:", update_response.text)
    # detection_response = await change_detection_agent.run(
    #     f"Input: {text}\nUpdater Agent Response: {update_response}"
    # )
    # print("Change Detection Agent Response:", detection_response.text)
    print(rounds)
    formatter_response = await formatter_agent.run(
        f"User Input: {text}\nAgent Discussion: {rounds}\nFormat the response into the TaskUpdateList schema.",
        options={"response_format": TaskUpdateList}
    )
    return formatter_response.value
