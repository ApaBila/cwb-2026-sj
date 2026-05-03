# SJ Project Manager

This project uses AI to make unstructured notes, emails, etc. into structured JSON project updates that are then used in a Gantt project tracker. Coded for [CWB 2026 Hackathon SJ Problem Statement](https://www.cwbhackathon.com/problem-statements/sj-project-planner-agent).

<!-- TODO: gif demo?-->

## Installation and Set Up
### Clone this repo:
```bash
git clone git@github.com:ApaBila/cwb-2026-sj.git
cd cwb-2026-sj
git submodule update --init --recursive
```

### Install backend dependencies
```bash
python3 -m venv .venv
pip install -r backend/requirements.txt

```
### Install frontend dependencies
```bash
 # from project root
npm install
```

### Set Up Env and Azure
* Open the Azure Portal
* Create an Azure Resource Group. Within it,
    * Create an Azure AI deployment.
    * Create an Azure PostgreSQL database.
    * Create a Microsoft Foundry project. Replace the details in update_formatter.py with your own.
* Now in this repo, create a backend/app/.env file with your Azure PostgreSQL database URL. The agent stack talks to Azure AI through Foundry using Azure identity (e.g. `az login` on your laptop for local dev).

## Usage

Now you can use the web app locally!

### Run the backend

```bash
cd backend
fastapi run
# use `fastapi dev` for dev mode where the server updates as files change
# see `fastapi --help` for more
```

Even without the frontend running, you can test the API via the Swagger UI
at `http://localhost:8000/docs`

### Run the frontend
In a **separate** terminal:
```bash
cd frontend
## Serve locally and see changes as you make changes to the code
npm run dev
## before that you can use npm run build (compiles) or npm run lint (doesn't compile)
## to check for code problems
```

This will be served at `http://localhost:5173/`.

## Hosting
For the hackathon demo I use Azure VM: nginx serves the Vite `dist` and proxies `/api/` to uvicorn, systemd keeps the backend up from the project venv.

<!-- todo: ## Acessibility -->

## Contributor Acknowledgement
*   backend: I developed the backend's AI API and set up all Azure resources.
    Copilot/Gemini assisted with sqlalchemy for managing the database and led creation of the seed/finetune data before the official data was released.
*   frontend: I initially generated the frontend by template, then quickly developed a basic prototype to test wiring to the backend with Copilot/Gemini assistance, then used open source projects w Copilot/Cursor assistance for a more polished look.
*   Copilot also helped with GitHub code reviews.

I tried to ensure the commit messages reflected this AI use but eventually removed Copilot (April 29) from being listed as a co-author for code autocompletion which I mostly used to quickly repeat previous code patterns. chatAndAgent use continues to credit Copilot as a co-author.
