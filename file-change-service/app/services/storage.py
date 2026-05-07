import httpx
from fastapi import HTTPException

from app.config import SUPABASE_UPLOAD_BUCKET, required_env


def _auth_headers(content_type: str | None = None) -> dict[str, str]:
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def upload_to_supabase(
    path: str, content: bytes, content_type: str, bucket: str = SUPABASE_UPLOAD_BUCKET
) -> None:
    base_url = required_env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{path}"
    headers = _auth_headers(content_type)
    headers["x-upsert"] = "false"
    response = httpx.post(upload_url, headers=headers, content=content, timeout=60)
    if response.status_code >= 300:
        raise HTTPException(status_code=500, detail=response.text)


def download_from_supabase(path: str, bucket: str = SUPABASE_UPLOAD_BUCKET) -> bytes:
    base_url = required_env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    download_url = f"{base_url}/storage/v1/object/{bucket}/{path}"
    response = httpx.get(download_url, headers=_auth_headers(), timeout=60)
    if response.status_code >= 300:
        raise HTTPException(status_code=404, detail="Sample file not found in storage.")
    return response.content


def list_supabase_objects(
    *,
    bucket: str = SUPABASE_UPLOAD_BUCKET,
    prefix: str = "",
    limit: int = 1000,
) -> list[dict]:
    base_url = required_env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    list_url = f"{base_url}/storage/v1/object/list/{bucket}"
    payload = {
        "prefix": prefix,
        "limit": limit,
        "offset": 0,
        "sortBy": {"column": "name", "order": "asc"},
    }
    response = httpx.post(
        list_url,
        headers=_auth_headers("application/json"),
        json=payload,
        timeout=60,
    )
    if response.status_code >= 300:
        raise HTTPException(status_code=500, detail="Could not list sample files from storage.")
    data = response.json()
    if not isinstance(data, list):
        raise HTTPException(status_code=500, detail="Unexpected storage list response.")
    return [item for item in data if isinstance(item, dict)]
