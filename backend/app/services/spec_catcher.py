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


def catch_spec(text: str, no_ai: bool = False):
    if no_ai:
        return """{
        "tasks":
            [
                {
                    "project": "Unspecified",
                    "source_date_iso": null,
                    "project_timezone": "Unspecified",
                    "task": "Unspecified",
                    "owner": null,
                    "due_date_raw": null,
                    "due_date_iso": null,
                    "status": "Unknown",
                    "dependency": null,
                    "source": null,
                    "confidence": "Low",
                    "action_type": "conflict_needs_clarification"
                },
                {
                    "project": "Unspecified",
                    "source_date_iso": null,
                    "project_timezone": "Unspecified",
                    "task": "Unspecified",
                    "owner": null,
                    "due_date_raw": null,
                    "due_date_iso": null,
                    "status": "Unknown",
                    "dependency": null,
                    "source": null,
                    "confidence": "Low",
                    "action_type": "conflict_needs_clarification"
                }
            ]
        }
        """

    response = client.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": """You are the SJ Project Task Updater Agent. Analyze unstructured meeting notes, emails, and conversations, then extract task updates into a structured response. Output STRICT JSON only as an object with the key tasks. tasks must be an array of task objects using snake_case keys only: project, task, owner, project_timezone, source_date_iso, due_date_iso, due_date_raw, status, dependency, source, confidence, action_type. Do not use spaces in key names. Use Unspecified for unknown project and unknown task. project_timezone must be an IANA timezone string or the string Unspecified. Use null for unknown owner, unknown due_date_raw (example: "next Tuesday"), unknown dependency, and unknown source. source_date_iso must be in YYYY-MM-DD and anchored to the source text date or null. due_date_iso must also be YYYY-MM-DD when confidently resolvable from source_date_iso, else null. Allowed status values: Not Started, In Progress, Blocked, Delayed, Done, Paused, At Risk, Unknown. confidence should reflect overall extraction and date-normalization certainty (High, Medium, Low). action_type should align with confidence. Allowed action_type values: new_task, update, conflict_needs_clarification. Keep values concise and deterministic for downstream programmatic updates (example for project value following adjective noun place format: Green City Bogor, min 1 word max 3 words).""",
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
