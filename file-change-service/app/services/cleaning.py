from typing import Any


def run_cleaning_pipeline(_parquet_bytes: bytes, _file_id: str) -> dict[str, Any]:
    """
    Temporary cleaning pipeline stub.

    Returns no suggested changes for now.
    """
    return {
        "row_count": 0,
        "cell_count": 0,
        "diff_rows": [],
        "diffs": [],
    }
