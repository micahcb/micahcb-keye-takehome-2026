import hashlib
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import SAMPLE_FILES_BUCKET, SAMPLE_FILES_PREFIX, SUPABASE_UPLOAD_BUCKET
from app.db import db_conn
from app.schemas import SampleUploadRequest
from app.services.cleaning import run_cleaning_pipeline
from app.services.storage import download_from_supabase, upload_to_supabase

router = APIRouter()


def process_parquet(
    *,
    file_name: str,
    file_bytes: bytes,
    content_type: str,
    upload_to_storage: bool,
):
    if not file_name.lower().endswith(".parquet"):
        raise HTTPException(status_code=400, detail="Only .parquet files are supported.")
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, storage_path, bucket_name
                FROM uploaded_files
                WHERE file_hash = %s
                LIMIT 1
                """,
                (file_hash,),
            )
            existing = cur.fetchone()
            if existing:
                file_id = str(existing[0])
                cur.execute("SELECT COUNT(*) FROM diff_rows WHERE file_id = %s", (file_id,))
                row_count = int(cur.fetchone()[0])
                cur.execute(
                    """
                    SELECT COUNT(d.id)
                    FROM diffs d
                    INNER JOIN diff_rows r ON r.id = d.row_id
                    WHERE r.file_id = %s
                    """,
                    (file_id,),
                )
                cell_count = int(cur.fetchone()[0])
                return {
                    "id": file_id,
                    "path": existing[1],
                    "bucket": existing[2],
                    "duplicate": True,
                    "rowCount": row_count,
                    "cellCount": cell_count,
                    "insertedDiffRows": 0,
                    "insertedDiffs": 0,
                }

            file_id = str(uuid.uuid4())
            extension = file_name.split(".")[-1] if "." in file_name else "parquet"
            storage_path = f"{file_id}.{extension}"
            bucket_name = "sample-data"
            if upload_to_storage:
                upload_to_supabase(storage_path, file_bytes, content_type)
                bucket_name = SUPABASE_UPLOAD_BUCKET

            cur.execute(
                """
                INSERT INTO uploaded_files
                  (id, file_name, storage_path, bucket_name, file_hash, mime_type, file_size)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    file_id,
                    file_name,
                    storage_path,
                    bucket_name,
                    file_hash,
                    content_type,
                    len(file_bytes),
                ),
            )

            detection = run_cleaning_pipeline(file_bytes, file_id)
            row_id_map: dict[int, str] = {}
            inserted_rows = 0
            inserted_diffs = 0

            for row in detection.get("diff_rows", []):
                diff_row_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO diff_rows (id, file_id, source_row_idx, status)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (file_id, source_row_idx) DO NOTHING
                    RETURNING id
                    """,
                    (diff_row_id, file_id, row["temp_id"], row["status"]),
                )
                inserted = cur.fetchone()
                if inserted:
                    row_id_map[row["temp_id"]] = str(inserted[0])
                    inserted_rows += 1
                else:
                    cur.execute(
                        """
                        SELECT id
                        FROM diff_rows
                        WHERE file_id = %s AND source_row_idx = %s
                        LIMIT 1
                        """,
                        (file_id, row["temp_id"]),
                    )
                    existing_row = cur.fetchone()
                    if existing_row:
                        row_id_map[row["temp_id"]] = str(existing_row[0])

            for diff in detection.get("diffs", []):
                mapped_row_id = row_id_map.get(diff["temp_row_id"])
                if not mapped_row_id:
                    continue
                cur.execute(
                    """
                    INSERT INTO diffs (id, row_id, column_id, suggested_val, current_val)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (row_id, column_id) DO NOTHING
                    RETURNING id
                    """,
                    (
                        str(uuid.uuid4()),
                        mapped_row_id,
                        diff["column_id"],
                        diff["suggested_val"],
                        diff["current_val"],
                    ),
                )
                if cur.fetchone():
                    inserted_diffs += 1

        conn.commit()

    return {
        "id": file_id,
        "path": storage_path,
        "bucket": bucket_name,
        "duplicate": False,
        "rowCount": detection.get("row_count", 0),
        "cellCount": detection.get("cell_count", 0),
        "insertedDiffRows": inserted_rows,
        "insertedDiffs": inserted_diffs,
    }


@router.post("/uploads")
async def uploads(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name.")
    file_bytes = await file.read()
    return process_parquet(
        file_name=file.filename,
        file_bytes=file_bytes,
        content_type=file.content_type or "application/octet-stream",
        upload_to_storage=True,
    )


@router.post("/uploads/sample")
async def upload_sample(payload: SampleUploadRequest):
    sample_name = payload.sampleFileName.strip()
    if not sample_name:
        raise HTTPException(status_code=400, detail="Sample file name is required.")
    if "/" in sample_name or "\\" in sample_name:
        raise HTTPException(status_code=400, detail="Sample file name must not include paths.")
    storage_path = f"{SAMPLE_FILES_PREFIX}/{sample_name}" if SAMPLE_FILES_PREFIX else sample_name
    file_bytes = download_from_supabase(storage_path, bucket=SAMPLE_FILES_BUCKET)

    return process_parquet(
        file_name=sample_name,
        file_bytes=file_bytes,
        content_type="application/octet-stream",
        upload_to_storage=False,
    )
