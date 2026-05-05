from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="file-change-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://micahcb-keye-takehome-2026-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FileChangeRequest(BaseModel):
    file_path: str
    change_id: str | None = None
    reason: str | None = None


@app.post("/add-file")
async def add_file(payload: FileChangeRequest):
    # PSEUDOCODE:
    # 1) Validate file path and caller permissions.
    # 2) Create a pending change record for this file.
    # 3) Return a new change_id and queued status.
    return {"route": "add-file", "status": "pseudo", "payload": payload.model_dump()}


@app.post("/accept-change")
async def accept_change(payload: FileChangeRequest):
    # PSEUDOCODE:
    # 1) Lookup pending change by change_id.
    # 2) Apply the change to the target file.
    # 3) Mark change as accepted and return result metadata.
    return {"route": "accept-change", "status": "pseudo", "payload": payload.model_dump()}


@app.post("/revert-change")
async def revert_change(payload: FileChangeRequest):
    # PSEUDOCODE:
    # 1) Lookup accepted change by change_id.
    # 2) Restore file from stored snapshot or patch inverse.
    # 3) Mark change as reverted.
    return {"route": "revert-change", "status": "pseudo", "payload": payload.model_dump()}


@app.post("/deny-change")
async def deny_change(payload: FileChangeRequest):
    # PSEUDOCODE:
    # 1) Lookup pending change by change_id.
    # 2) Mark it denied and store reason.
    # 3) Return final denied status.
    return {"route": "deny-change", "status": "pseudo", "payload": payload.model_dump()}


@app.get("/get-file")
async def get_file(file_path: str):
    # PSEUDOCODE:
    # 1) Validate requested file_path and permissions.
    # 2) Load file metadata/content preview.
    # 3) Return file details for client display.
    return {"route": "get-file", "status": "pseudo", "file_path": file_path}
