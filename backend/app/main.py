from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .services.spec_catcher import catch_spec
import json
from .schemas import ProjectUpdate
from openai import APIStatusError

app = FastAPI(title="SJ Project Planner API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "online", "message": "SJ Planner Backend is running"}


@app.post("/api/project-update")
async def project_update(payload: dict = Body(...)):
    text = payload.get("text", "")

    if not text:
        raise HTTPException(
            status_code=400, detail="Missing 'text' in request body.")

    try:
        ai_response = catch_spec(text)

        try:
            raw_response = json.loads(ai_response)  # type: ignore
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500, detail="AI did not return valid JSON.")
        try:
            validated_response = ProjectUpdate(**raw_response)
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error validating the response: {str(e)}")
        return validated_response.model_dump(mode='json')
    except APIStatusError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail=e.message
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing the request: {str(e)}")
