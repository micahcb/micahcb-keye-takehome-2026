import os
from pathlib import Path

from fastapi import HTTPException
from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Support both service-local and project-root .env files.
load_dotenv(SERVICE_ROOT / ".env")
load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_UPLOAD_BUCKET = os.getenv("SUPABASE_UPLOAD_BUCKET", "uploads")
SAMPLE_FILES_BUCKET = os.getenv("SAMPLE_FILES_BUCKET", SUPABASE_UPLOAD_BUCKET)
SAMPLE_FILES_PREFIX = os.getenv("SAMPLE_FILES_PREFIX", "samples")


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing {name} env var.")
    return value
