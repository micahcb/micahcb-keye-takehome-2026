import io

import numpy as np
import pandas as pd


def _append_diff(
    *,
    diffs: list[dict],
    seen_cells: set[tuple[int, str]],
    row_idx: int,
    column_id: str,
    suggested_val: float,
    current_val: float,
) -> bool:
    key = (row_idx, column_id)
    if key in seen_cells:
        return False
    diffs.append(
        {
            "temp_row_id": row_idx,
            "column_id": column_id,
            "suggested_val": suggested_val,
            "current_val": current_val,
        }
    )
    seen_cells.add(key)
    return True


def _run_case_1_refund_windows(
    *,
    working_values: np.ndarray,
    row_index_values: np.ndarray,
    value_columns: list[str],
    diffs: list[dict],
    seen_cells: set[tuple[int, str]],
) -> None:
    neg_row_pos = np.where((working_values < 0).any(axis=1))[0]
    neg_values = working_values[neg_row_pos]
    neg_left_vals = neg_values[:, :-1]
    neg_right_vals = neg_values[:, 1:]
    row_pos, col_pos = np.where((neg_left_vals > 0) & (neg_right_vals == -neg_left_vals))
    for r_pos, c_pos in zip(row_pos, col_pos):
        source_row_pos = int(neg_row_pos[r_pos])
        row_idx = int(row_index_values[source_row_pos])
        left_col_pos = int(c_pos)
        left_col = value_columns[left_col_pos]
        right_col_pos = int(c_pos + 1)
        right_col = value_columns[right_col_pos]
        left_current_val = float(working_values[source_row_pos, left_col_pos])
        current_val = float(working_values[source_row_pos, right_col_pos])
        left_added = _append_diff(
            diffs=diffs,
            seen_cells=seen_cells,
            row_idx=row_idx,
            column_id=left_col,
            suggested_val=0.0,
            current_val=left_current_val,
        )
        right_added = _append_diff(
            diffs=diffs,
            seen_cells=seen_cells,
            row_idx=row_idx,
            column_id=right_col,
            suggested_val=0.0,
            current_val=current_val,
        )
        if left_added:
            working_values[source_row_pos, left_col_pos] = 0.0
        if right_added:
            working_values[source_row_pos, right_col_pos] = 0.0


def _run_case_2_negative_values(
    *,
    working_values: np.ndarray,
    row_index_values: np.ndarray,
    value_columns: list[str],
    diffs: list[dict],
    seen_cells: set[tuple[int, str]],
) -> None:
    neg_row_pos = np.where((working_values < 0).any(axis=1))[0]
    neg_values = working_values[neg_row_pos]
    prev_vals = np.zeros_like(neg_values)
    prev_vals[:, 1:] = neg_values[:, :-1]
    row_pos, col_pos = np.where((neg_values < 0) & (prev_vals != -neg_values))
    for r_pos, c_pos in zip(row_pos, col_pos):
        source_row_pos = int(neg_row_pos[r_pos])
        row_idx = int(row_index_values[source_row_pos])
        col_pos_int = int(c_pos)
        col = value_columns[col_pos_int]
        current_val = float(working_values[source_row_pos, col_pos_int])
        added = _append_diff(
            diffs=diffs,
            seen_cells=seen_cells,
            row_idx=row_idx,
            column_id=col,
            suggested_val=0.0,
            current_val=current_val,
        )
        if added:
            working_values[source_row_pos, col_pos_int] = 0.0


def _run_case_3_double_booking(
    *,
    working_values: np.ndarray,
    row_index_values: np.ndarray,
    value_columns: list[str],
    diffs: list[dict],
    seen_cells: set[tuple[int, str]],
) -> None:
    left_vals = working_values[:, :-1]
    right_vals = working_values[:, 1:]
    row_pos, col_pos = np.where((left_vals > 0) & (right_vals == 0))
    for r_pos, c_pos in zip(row_pos, col_pos):
        row_pos_int = int(r_pos)
        row_idx = int(row_index_values[row_pos_int])
        left_col_pos = int(c_pos)
        left_col = value_columns[left_col_pos]
        right_col_pos = int(c_pos + 1)
        right_col = value_columns[right_col_pos]
        source_val = float(left_vals[row_pos_int, int(c_pos)])
        half_val = source_val / 2.0
        left_current_val = float(working_values[row_pos_int, left_col_pos])
        current_val = float(right_vals[row_pos_int, int(c_pos)])
        left_added = _append_diff(
            diffs=diffs,
            seen_cells=seen_cells,
            row_idx=row_idx,
            column_id=left_col,
            suggested_val=half_val,
            current_val=left_current_val,
        )
        right_added = _append_diff(
            diffs=diffs,
            seen_cells=seen_cells,
            row_idx=row_idx,
            column_id=right_col,
            suggested_val=half_val,
            current_val=current_val,
        )
        if left_added:
            working_values[row_pos_int, left_col_pos] = half_val
        if right_added:
            working_values[row_pos_int, right_col_pos] = half_val


def _build_diff_rows(diffs: list[dict]) -> list[dict]:
    seen_row_ids: set[int] = set()
    diff_rows: list[dict] = []
    for diff in diffs:
        row_id = int(diff["temp_row_id"])
        if row_id in seen_row_ids:
            continue
        diff_rows.append({"temp_id": row_id, "status": "suggested"})
        seen_row_ids.add(row_id)
    return diff_rows


def run_cleaning_pipeline(file_bytes: bytes, file_id: str) -> dict:
    del file_id  # currently unused, kept for API compatibility
    df = pd.read_parquet(io.BytesIO(file_bytes))
    if df.empty:
        return {"diff_rows": [], "diffs": [], "row_count": 0, "cell_count": 0}

    value_columns = list(df.columns[2:]) if len(df.columns) > 2 else []
    if len(value_columns) < 2:
        return {"diff_rows": [], "diffs": [], "row_count": 0, "cell_count": 0}

    values_df = df[value_columns].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    row_index_values = values_df.index.to_numpy()
    working_values = values_df.to_numpy(copy=True)

    diffs: list[dict] = []
    seen_cells: set[tuple[int, str]] = set()

    _run_case_1_refund_windows(
        working_values=working_values,
        row_index_values=row_index_values,
        value_columns=value_columns,
        diffs=diffs,
        seen_cells=seen_cells,
    )
    _run_case_2_negative_values(
        working_values=working_values,
        row_index_values=row_index_values,
        value_columns=value_columns,
        diffs=diffs,
        seen_cells=seen_cells,
    )
    _run_case_3_double_booking(
        working_values=working_values,
        row_index_values=row_index_values,
        value_columns=value_columns,
        diffs=diffs,
        seen_cells=seen_cells,
    )
    diff_rows = _build_diff_rows(diffs)

    return {
        "diff_rows": diff_rows,
        "diffs": diffs,
        "row_count": len(diff_rows),
        "cell_count": len(diffs),
    }

