import os
import uuid
from agent_framework import Agent, AgentResponseUpdate, WorkflowBuilder
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from app.schemas import TaskUpdateList, TaskUpdate, WorkflowExecutionResponse
from app.services.change_detector import query_existing_tasks

import json
from agent_framework import tool
from app.models import Task, Project, Person, Dependency

# https://github.com/microsoft/agent-framework/blob/main/python/samples/03-workflows/agents/azure_ai_agents_streaming.py

TEMPERATURE = 0.01
SEED = 123

client = FoundryChatClient(
    project_endpoint=os.getenv(
        "FOUNDRY_PROJECT_ENDPOINT",
        "https://cwb-sj-planner.services.ai.azure.com/api/projects/cwb-sj-planner",
    ),
    model=os.getenv("FOUNDRY_MODEL", "gpt-4.1-mini-1"),
    credential=DefaultAzureCredential(),
)

details_agent = Agent(
    client=client,
    name="SJ-Details-Agent",
    default_options={"temperature": TEMPERATURE, "seed": SEED},
    instructions=f"""
    You are the SJ Group Details Agent.
    You are part of an elite team of agents that will analyze unstructured meeting notes, emails, and turn them into structured task updates.
    You find the relevant details from the unstructured text, aiming for task update accuracy and completeness.
    Remember, it's more likely you get information about Tasks than Projects and People, but when you do, use them to ground your details.
    The Change Detection Agent will check the details you find against the database and inform you whether a task is new, an update, or there's a conflict that needs clarification.
    Their feedback will also help you understand the database's naming conventions.
    The Workflow Executor Agent will execute a workflow between you and the Change Detection Agent.
    This back and forth is for you to refine your details based on factual database responses, and the Workflow Agent will give an editorialized summary of this to the Formatter Agent.
    You should clearly state if you believe you need another attempt due to uncertainty, especially if it might be resolved with the Change Detection Agent's feedback.
    Finally, the Formatter Agent will make take the user input and the Workflow Agent's response and format it into TaskUpdate objects that are formatted as: {json.dumps(TaskUpdate.model_json_schema(), indent=2, sort_keys=True)} for best database ingestion.
    You should be conservative and highlight uncertainties for succeeding agents.
    Note clearly when you've exhausted your resources and are making a final attempt.
    Your response can be a list of tasks with details gleaned from the input and "Unknown"/"Unspecified"/null otherwise.
    No need to format, just focus on finding details and the other agents will help with ensuring database coherency and formatting.
    If you're told there's an exact duplicate, don't add this task update to the list!
    """,
)

change_detection_agent = Agent(
    client=client,
    name="SJ-Change-Detection-Agent",
    default_options={"temperature": TEMPERATURE, "seed": SEED},
    tools=[query_existing_tasks],
    instructions=f"""
    You are the SJ Group Task Change Detection Agent.
    You are a meticulous SQL expert.
    You will take the response from the details extractor agent and run multiple queries on the database to determine if each task is new, or if it's not what are the updates, and if human clarification is needed.
    You should start broadly to understand the current state of the database, what are ids like, what are naming conventions, who usually works on what tasks.
    You should find similar tasks, projects, people.
    Tasks IDs are unique and sequential but task_titles are not.
    Project IDs are unique and sequential but project_names are not.
    Dependencies use task ids.
    If task_id and project_id are present in input, you MUST start with this exact query pattern (batch all ids):
    SELECT task_id, project_id, task_title, owner_id, owner_name, planned_start, planned_due, status, percent_complete, priority, is_approved
    FROM tasks
    WHERE project_id='<PROJECT_ID>' AND task_id IN ('<ID1>','<ID2>',...);
    If you find an exact match for all other columns for a task_id project_id pair,
    mark as a duplicate and make sure succeeding agents know to ignore this task update ie not add to datbase.
    Remember to use fuzzy searches for task_titles or project names because natural language allows the same thing to be said in many ways.
    Check if owner_name and owner_id are present and match.
    Use wildcards and partial matches etc.
    You can use as many queries as needed. Not catching a previous task is much worse than taking a long time or falsely identifying a task when you could mark it for conflict.
    But remember to batch queries when possible.
    These are the tables you can query:
    {json.dumps({"Tasks": Task.__table__.columns.keys(), "Projects": Project.__table__.columns.keys(), "People": Person.__table__.columns.keys(), "Dependencies": Dependency.__table__.columns.keys()}, indent=2, sort_keys=True)}

    Only give your response after all your queries are done.
    Your succinct output will be used by the details extractor agent to adjust their response and by the formatter agent to format the final response.
    You should note your uncertainties so succeeding agents can adjust overall confidence accordingly.
    You should aim to align the details extractor agent's description of tasks with the database's description.
    That is, the organization's conventions for titling tasks, describing their details, their relation to projects and people, etc.
    Note when you've believed you've exhausted your resources so the details extractor agent makes it's final attempt.
    No need to respond to the details extractor agent's final attempt.
    """
)

workflow = WorkflowBuilder(start_executor=details_agent).add_edge(
    details_agent, change_detection_agent).build()


@tool(approval_mode="never_require", max_invocations=7)
async def workflow_execution(workflow_text: str) -> str:
    print("Input:", workflow_text)
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
        joined = "\n".join(responses)
        return joined
    else:
        return "Workflow didn't work."


workflow_executor = Agent(
    client=client,
    name="SJ-Workflow-Executor-Agent",
    default_options={"temperature": TEMPERATURE, "seed": SEED},
    tools=[workflow_execution],
    instructions=f"""
    You are the SJ Group Task Workflow Executor Agent.
    You are part of an elite team of agents that will analyze unstructured meeting notes, emails, and turn them into structured task updates.
    You will execute the workflow iteratively between the detail extraction agent and change detection agent. 
    Remember to give the user's input text to the workflow executor so these agents can use it.
    After the first iteration, call the tool again and append this input text with a quick recap of previous iteration(s).
    Iterate until there's no new info to give to either agent.
    If you believe without a doubt that the detail agent has responded adequately to the change detection agent, or has preempted, don't call again.
    Err on giving too many chances to the agents instead of cutting them off too early.
    Your only response should be their conversation for the formatter agent to use,
    whose job is to format the final response into the following schema for the database:  {json.dumps(TaskUpdate.model_json_schema(), indent=2, sort_keys=True)}.
    However, if there are no meaningful tasks (i.e, duplicates or completely no information), instruct the format agent to return an empty list.
    """
)

formatter_agent = Agent(
    client=client,
    name="SJ-Formatter-Agent",
    default_options={"temperature": TEMPERATURE, "seed": SEED},
    instructions="""
    You are the SJ Group Task Formatter Agent.
    You must use your fellow agents previous responses to format the final output into the TaskUpdateList schema that the frontend expects, with the best values possible.
    Downstream conflicts into action_type=conflict_needs_clarification and lower confidence.
    Task title should never be none if there actually is a task.
    If you're told there's an exact duplicate, don't add this task update to the list!
    If there are no meaningful tasks (i.e, duplicates or completely no information) to add to the database, return an empty list.
    """,
)


async def format_update(text: str, no_ai: bool = False) -> TaskUpdateList:
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

    workflow_executor_response_text = await workflow_execution(text)
    print("\nWorkflow Executor Response:", workflow_executor_response_text)

    formatter_prompt = f"""\nUser Input: {text}\n
        \nDetails Extractor Agent and Change Detection Agent Discussion: \n{workflow_executor_response_text}
        """

    formatter_response = await formatter_agent.run(
        formatter_prompt,
        options={"response_format": TaskUpdateList,
                 "temperature": TEMPERATURE, "seed": SEED}
    )
    return TaskUpdateList.model_validate(formatter_response.value)
