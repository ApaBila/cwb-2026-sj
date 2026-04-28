# SJ Project Updater

This project uses AI to make unstructured notes, emails, etc. into structured JSON project updates that are then used in a Gantt project tracker. Coded for [CWB 2026 Hackathon SJ Problem Statement](https://www.cwbhackathon.com/problem-statements/sj-project-planner-agent).

<!-- TODO: gif demo?-->

## Installation and Set Up
### Clone this repo:
```bash
git clone git@github.com:ApaBila/cwb-2026-sj.git
cd cwb-2026-sj
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
* Now in this repo, create a backend/app/.env file with your Azure AI API key and Azure PostgreSQL database URL.

## Usage

Now you can use the web app locally!

### Run the backend

```bash
cd backend
fastapi dev
```

## Run the frontend
In a **separate** terminal:
```bash
cd frontend
npm run dev
```