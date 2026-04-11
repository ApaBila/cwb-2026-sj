import os
from pathlib import Path
from openai import AzureOpenAI


env_path = Path(__file__).resolve().parent.parent.parent / ".env"
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


def catch_spec(text: str):
    response = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are the SJ Project Planner Agent. Analyze unstructured meeting notes, emails, and conversations, then extract project updates into a structured response. Output STRICT JSON only as an object with keys: source_date_iso, project_timezone, tasks. source_date_iso must be in YYYY-MM-DD and anchored to the source text date. project_timezone must be an IANA timezone string (use Asia/Singapore unless another timezone is explicitly provided). tasks must be an array of task objects using snake_case keys only: task, owner, due_date_raw, due_date_iso, status, dependency, action_type, source, confidence. Do not use spaces in key names. due_date_raw preserves the original phrasing from source text. due_date_iso must be YYYY-MM-DD when confidently resolvable from source_date_iso, else null. Do NOT add any due_date_resolution field. Allowed action_type values: new_task, update, conflict_needs_clarification. Use null for unknown dependency, Unassigned for unknown owner, and Unspecified for unknown due_date_raw. Allowed status values: Not Started, In Progress, Blocked, Delayed, Done, Paused, At Risk, Unknown. Keep values concise and deterministic for downstream programmatic updates (for example, plan/Gantt updates). Confidence should reflect extraction and date-normalization certainty (High, Medium, Low).",
            },
            {
                "role": "user",
                "content": text
            }
        ],
        max_completion_tokens=13107,
        temperature=1.0,
        top_p=1.0,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        model=deployment
    )

    return response.choices[0].message.content
