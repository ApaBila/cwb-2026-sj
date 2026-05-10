# The Loop

This project uses AI to make unstructured notes, emails, etc. into structured JSON project updates that are then used in a Gantt project tracker. Coded for [CWB 2026 Hackathon SJ Problem Statement](https://www.cwbhackathon.com/problem-statements/sj-project-planner-agent).

**Get In** (`/`) is the submission and draft-review flow, so you can easily loop in updates for yourself and others.
**Stay In** (`/Gantt`) displays the unscheduled tasks table and Gantt chart, so you can stay in the loop regarding the project's latest status.

<!-- TODO: gif demo?-->

## Installation and Set Up
### Clone this repo:
```bash
git clone git@github.com:ApaBila/cwb-2026-sj.git
cd cwb-2026-sj
git submodule update --init --recursive
```

The `CWB_SJ` submodule holds the hackathon dataset. See `CWB_SJ/README_dataset_dictionary.json` for field descriptions.

### Install backend dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```
### Install frontend dependencies
```bash
cd frontend && npm install
```

### Set Up Env and Azure
* Open the Azure Portal
* Create an Azure Resource Group. Within it,
    * Create a Microsoft Foundry project / model deployment you can call from the app.
    * Create an Azure PostgreSQL database.
* Now in this repo, create a backend/app/.env file with your Azure PostgreSQL database URL. The agent stack uses Azure identity (e.g. `az login` on your laptop for local dev).
* Optional dev: you can configure `FOUNDRY_PROJECT_ENDPOINT` and `FOUNDRY_MODEL` in .env, my experiments found the current one to be the best balance for speed and performance.
* Optional local dev: add `SJ_NO_AI=true` to the backend `.env` so empty drafts are created as in "update_formatter.py" instead of actually calling Foundry agent (saves credits). Not for production. Might have to restart server to take effect.

## Usage

Now you can use the web app locally!

### Run the backend

Activate the venv from repo root (`.venv`) if you haven't, then:

```bash
cd backend # if in root
fastapi run
# use `fastapi dev` for dev mode where the server updates as files change
# see `fastapi --help` for more
```

Even without the frontend running, you can test the API via the Swagger UI
at `http://localhost:8000/docs`

### Run the frontend
In a **separate** terminal:
```bash
cd frontend  # if in root
## Serve locally and see changes as you make changes to the code
npm run dev
## before that you can use npm run build (compiles) or npm run lint (doesn't compile)
## to check for code problems
```

This will be served at `http://localhost:5173/`. In dev, the UI calls the API at `http://localhost:8000`. With nginx (below), the built app uses same-origin `/api/`.

### API (summary)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health / DB check |
| POST | `/api/drafts/create` | Run formatter → draft rows |
| POST | `/api/drafts/create/stream` | Same as create, SSE progress |
| GET | `/api/drafts` | List unapproved (draft) tasks |
| POST | `/api/drafts/changelog` | Diff selected drafts vs approved baseline |
| POST | `/api/drafts/approve` | Approve drafts (`*_draft` ids) |
| DELETE | `/api/drafts/reject` | Drop draft rows |
| GET | `/api/tasks` | Approved tasks + deps for Gantt |

Full schemas: `http://localhost:8000/docs`.

## Hosting
For the hackathon demo I use Azure VM: nginx serves the Vite `dist` and proxies `/api/` to uvicorn, systemd keeps the backend up from the project venv.

<!-- todo: ## Acessibility -->

## Contributor Acknowledgement
*   backend: I developed the backend's AI API and set up all Azure resources.
    Copilot/Gemini assisted with sqlalchemy for managing the database and led creation of the seed/finetune data before the official data was released. Cursor enabled chat streaming.
*   frontend: I initially generated the frontend by template, then quickly developed a basic prototype to test wiring to the backend with Copilot/Gemini assistance, then used open source projects w Copilot/Cursor assistance for a more polished look.
*   Copilot also helped with GitHub code reviews.

I tried to ensure the commit messages reflected this AI use but eventually removed Copilot (April 29) from being listed as a co-author for code autocompletion which I mostly used to quickly repeat previous code patterns. chatAndAgent use continues to credit Copilot as a co-author.
