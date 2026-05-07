from fastapi import APIRouter, HTTPException

from app.db import db_conn
from app.schemas import FileActionRequest, RowActionRequest

router = APIRouter(prefix="/review")


def action_to_status(action: str) -> str:
    mapping = {"accept": "accepted", "reject": "denied", "revert": "suggested"}
    if action not in mapping:
        raise HTTPException(status_code=400, detail="Invalid action.")
    return mapping[action]


@router.post("/row-action")
async def review_row_action(payload: RowActionRequest):
    status = action_to_status(payload.action)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE diff_rows
                SET status = %s
                WHERE id = %s AND file_id = %s
                RETURNING id
                """,
                (status, payload.rowId, payload.fileId),
            )
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Diff row not found for this file.")
    return {"ok": True, "rowId": str(row[0]), "status": status}


@router.post("/file-action")
async def review_file_action(payload: FileActionRequest):
    status = action_to_status(payload.action)
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE diff_rows
                SET status = %s
                WHERE file_id = %s
                RETURNING id
                """,
                (status, payload.fileId),
            )
            updated_rows = cur.fetchall()
        conn.commit()
    return {"ok": True, "updatedRows": len(updated_rows), "status": status}


@router.get("/file-data")
async def review_file_data(fileId: str, limit: int = 25):
    safe_limit = max(1, min(limit, 10_000))
    with db_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source_row_idx, status
                FROM diff_rows
                WHERE file_id = %s
                ORDER BY source_row_idx ASC
                LIMIT %s
                """,
                (fileId, safe_limit),
            )
            row_records = cur.fetchall()

            rows: list[dict] = []
            row_ids: list[str] = []
            for record in row_records:
                row_id = str(record[0])
                rows.append(
                    {
                        "id": row_id,
                        "source_row_idx": int(record[1]),
                        "status": str(record[2]),
                    }
                )
                row_ids.append(row_id)

            diffs_by_row: dict[str, list[dict]] = {row_id: [] for row_id in row_ids}
            if row_ids:
                cur.execute(
                    """
                    SELECT id, row_id, column_id, suggested_val, current_val
                    FROM diffs
                    WHERE row_id = ANY(%s::uuid[])
                    ORDER BY row_id ASC, column_id ASC
                    """,
                    (row_ids,),
                )
                for diff_record in cur.fetchall():
                    parent_row_id = str(diff_record[1])
                    diffs_by_row.setdefault(parent_row_id, []).append(
                        {
                            "id": str(diff_record[0]),
                            "column_id": str(diff_record[2]),
                            "suggested_val": (
                                float(diff_record[3]) if diff_record[3] is not None else None
                            ),
                            "current_val": (
                                float(diff_record[4]) if diff_record[4] is not None else None
                            ),
                        }
                    )

    rows_with_diffs = [{"row": row, "diffs": diffs_by_row.get(row["id"], [])} for row in rows]
    return {"rows": rows_with_diffs}
