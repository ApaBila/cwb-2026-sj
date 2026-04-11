import os
from pathlib import Path
from openai import AzureOpenAI


env_path = Path(__file__).with_name(".env")
if env_path.exists():
    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

endpoint = "https://spec-catcher.openai.azure.com/"
model_name = "gpt-4.1-mini"
deployment = "gpt-4-1-mini-2025-04-14-ft-6c97fa76539f47b9af7c550c4468add3"

subscription_key = os.environ.get("OPENAI_API_KEY")
api_version = "2024-12-01-preview"

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=endpoint,
    api_key=subscription_key,
)

response = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "You are the SJ Project Planner Agent. Analyze unstructured meeting notes, emails, and conversations, then extract project updates into a structured response. Output STRICT JSON only as an object with keys: source_date_iso, project_timezone, tasks. source_date_iso must be in YYYY-MM-DD and anchored to the source text date. project_timezone must be an IANA timezone string (use Asia/Singapore unless another timezone is explicitly provided). tasks must be an array of task objects using snake_case keys only: task, owner, due_date_raw, due_date_iso, status, dependency, action_type, source, confidence. Do not use spaces in key names. due_date_raw preserves the original phrasing from source text. due_date_iso must be YYYY-MM-DD when confidently resolvable from source_date_iso, else null. Do NOT add any due_date_resolution field. Allowed action_type values: new_task, update, conflict_needs_clarification. Use null for unknown dependency, Unassigned for unknown owner, and Unspecified for unknown due_date_raw. Allowed status values: Not Started, In Progress, Blocked, Delayed, Done, Paused, At Risk, Unknown. Keep values concise and deterministic for downstream programmatic updates (for example, plan/Gantt updates). Confidence should reflect extraction and date-normalization certainty (High, Medium, Low).",
        },
        {
            "role": "user",
            "content": "Meeting Notes - SJ Campus Aquila-X Command Centre\nDate: Oct 12\nAttendees: Sarah (Digital Lead), John (Systems Engineer), David (BIM Coordinator), Emma (O&M Manager)\nNotes: Sarah mentioned she has started the UI/UX wireframes for the new 5G Integrated Command Centre dashboard and expects to finish them by next Wednesday. John is currently blocked on the BMS (Building Management System) sensor integration because we don't have the final digital twin data mapping yet. David agreed to take ownership of finalizing the digital twin mapping and promised to submit it to the SO (Superintending Officer) by this Friday. Emma asked about the cybersecurity audit required for our BCA Green Mark Platinum submission; no one is assigned yet, but we need it done before the end of the month to avoid TOP (Temporary Occupation Permit) delays.",
        }
    ],
    max_completion_tokens=13107,
    temperature=1.0,
    top_p=1.0,
    frequency_penalty=0.0,
    presence_penalty=0.0,
    model=deployment
)

print(response.choices[0].message.content)
