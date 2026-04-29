import uuid
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential

# https://github.com/microsoft/agent-framework/blob/main/python/samples/01-get-started/01_hello_agent.py

# from azure.ai.projects import AIProjectClient

from app.schemas import TaskUpdateList, TaskUpdate

client = FoundryChatClient(
    project_endpoint="https://cwb-sj-planner.services.ai.azure.com/api/projects/cwb-sj-planner",
    model="gpt-4.1-mini-1",
    credential=AzureCliCredential(),
)

agent = Agent(
    client=client,
    name="SJ-Update-Formatter-Agent",
    instructions="""You are the SJ Project Task Updater Agent. Analyze unstructured meeting notes, emails, and conversations, then extract task updates into a structured response. Output STRICT JSON only as an object with the key tasks. tasks must be an array of task objects using snake_case keys only: project, task, owner, project_timezone, source_date_iso, due_date_iso, due_date_raw (example: "next Tuesday"), status, dependency, source, confidence, action_type. Do not use spaces in key names. Use Unspecified for unknown project and unknown task. project_timezone must be an IANA timezone string or the string Unspecified. Use null for unknown owner, unknown due_date_raw, unknown dependency, and unknown source. source_date_iso must be in YYYY-MM-DD and anchored to the source text date or null. due_date_iso must also be YYYY-MM-DD when confidently resolvable from source_date_iso, else null. Allowed status values: Not Started, In Progress, Blocked, Delayed, Done, Paused, At Risk, Unknown. confidence should reflect overall extraction and date-normalization certainty (High, Medium, Low). action_type should align with confidence. Allowed action_type values: new_task, update, conflict_needs_clarification. Keep values concise and deterministic for downstream programmatic updates (example for project value following adjective noun place format: Green City Bogor, min 1 word max 3 words)."""
)

# endpoint = "https://cwb-sj-planner.services.ai.azure.com/api/projects/cwb-sj-planner"

# project_client = AIProjectClient(
#     endpoint=endpoint,
#     credential=AzureCliCredential(),
# )

# my_agent = "SJ-Update-Formatter-Agent"
# my_version = "2"

# openai_client = project_client.get_openai_client()


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
    # response = openai_client.responses.create(
    #     input=[
    #         {
    #             "type": "message",
    #             "role": "developer",
    #             "content": """You are the SJ Project Task Updater Agent. Analyze unstructured meeting notes, emails, and conversations, then extract task updates into a structured response. Output STRICT JSON only as an object with the key tasks. tasks must be an array of task objects using snake_case keys only: project, task, owner, project_timezone, source_date_iso, due_date_iso, due_date_raw(example: "next Tuesday"), status, dependency, source, confidence, action_type. Do not use spaces in key names. Use Unspecified for unknown project and unknown task. project_timezone must be an IANA timezone string or the string Unspecified. Use null for unknown owner, unknown due_date_raw, unknown dependency, and unknown source. source_date_iso must be in YYYY-MM-DD and anchored to the source text date or null. due_date_iso must also be YYYY-MM-DD when confidently resolvable from source_date_iso, else null. Allowed status values: Not Started, In Progress, Blocked, Delayed, Done, Paused, At Risk, Unknown. confidence should reflect overall extraction and date-normalization certainty(High, Medium, Low). action_type should align with confidence. Allowed action_type values: new_task, update, conflict_needs_clarification. Keep values concise and deterministic for downstream programmatic updates (look to database for examples).""",
    #         },
    #         {
    #             "type": "message",
    #             "role": "user",
    #             "content": text
    #         }
    #     ],
    #     extra_body={
    #         "agent_reference": {
    #             "name": my_agent,
    #             "version": my_version,
    #             "type": "agent_reference"
    #         }
    #     }
    # )  # type: ignore
    # return response.output_text
