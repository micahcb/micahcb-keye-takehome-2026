from pathlib import Path

import pandas as pd
import pytest

from app.services.cleaning import run_cleaning_pipeline

CASE_1_CHECKS = [
    ("Case1_Customer_01", "2023_2", 101.0, 0.0),
    ("Case1_Customer_01", "2023_3", -101.0, 0.0),
    ("Case1_Customer_02", "2021_11", 102.0, 0.0),
    ("Case1_Customer_02", "2021_12", -102.0, 0.0),
    ("Case1_Customer_03", "2022_4", 103.0, 0.0),
    ("Case1_Customer_03", "2022_5", -103.0, 0.0),
    ("Case1_Customer_04", "2022_9", 104.0, 0.0),
    ("Case1_Customer_04", "2022_10", -104.0, 0.0),
    ("Case1_Customer_05", "2023_4", 105.0, 0.0),
    ("Case1_Customer_05", "2023_5", -105.0, 0.0),
    ("Case1_Customer_06", "2021_6", 106.0, 0.0),
    ("Case1_Customer_06", "2021_7", -106.0, 0.0),
    ("Case1_Customer_07", "2023_7", 107.0, 0.0),
    ("Case1_Customer_07", "2023_8", -107.0, 0.0),
    ("Case1_Customer_08", "2022_10", 108.0, 0.0),
    ("Case1_Customer_08", "2022_11", -108.0, 0.0),
    ("Case1_Customer_09", "2021_7", 109.0, 0.0),
    ("Case1_Customer_09", "2021_8", -109.0, 0.0),
    ("Case1_Customer_10", "2023_1", 110.0, 0.0),
    ("Case1_Customer_10", "2023_2", -110.0, 0.0),
    ("Case1_Customer_11", "2022_6", 111.0, 0.0),
    ("Case1_Customer_11", "2022_7", -111.0, 0.0),
    ("Case1_Customer_12", "2021_1", 112.0, 0.0),
    ("Case1_Customer_12", "2021_2", -112.0, 0.0),
    ("Case1_Customer_13", "2021_4", 113.0, 0.0),
    ("Case1_Customer_13", "2021_5", -113.0, 0.0),
    ("Extra_Customer_06", "2021_3", 50.0, 0.0),
    ("Extra_Customer_06", "2021_4", -50.0, 0.0),
]

CASE_2_CHECKS = [
    ("Case2_Customer_01", "2021_11", -41.0, 0.0),
    ("Case2_Customer_02", "2021_12", -42.0, 0.0),
    ("Case2_Customer_03", "2021_8", -43.0, 0.0),
    ("Case2_Customer_04", "2023_4", -44.0, 0.0),
    ("Case2_Customer_05", "2022_8", -45.0, 0.0),
    ("Case2_Customer_06", "2022_2", -46.0, 0.0),
    ("Case2_Customer_07", "2023_3", -47.0, 0.0),
    ("Case2_Customer_08", "2022_7", -48.0, 0.0),
    ("Case2_Customer_09", "2022_6", -49.0, 0.0),
    ("Case2_Customer_10", "2021_10", -50.0, 0.0),
    ("Case2_Customer_11", "2021_3", -51.0, 0.0),
    ("Case2_Customer_12", "2021_6", -52.0, 0.0),
    ("Case3_Customer_01", "2021_1", -5.0, 0.0),
    ("Case3_Customer_02", "2021_1", -6.0, 0.0),
    ("Extra_Customer_06", "2021_6", -30.0, 0.0),
]

CASE_3_CHECKS = [
    ("Case3_Customer_01", "2022_1", 71.0, 35.5),
    ("Case3_Customer_01", "2022_2", 0.0, 35.5),
    ("Case3_Customer_02", "2023_3", 72.0, 36.0),
    ("Case3_Customer_02", "2023_4", 0.0, 36.0),
    ("Case3_Customer_03", "2022_6", 73.0, 36.5),
    ("Case3_Customer_03", "2022_7", 0.0, 36.5),
    ("Case3_Customer_04", "2022_3", 74.0, 37.0),
    ("Case3_Customer_04", "2022_4", 0.0, 37.0),
    ("Case3_Customer_05", "2022_10", 75.0, 37.5),
    ("Case3_Customer_05", "2022_11", 0.0, 37.5),
    ("Case3_Customer_06", "2023_1", 76.0, 38.0),
    ("Case3_Customer_06", "2023_2", 0.0, 38.0),
    ("Case3_Customer_07", "2023_2", 77.0, 38.5),
    ("Case3_Customer_07", "2023_3", 0.0, 38.5),
    ("Case3_Customer_08", "2022_4", 78.0, 39.0),
    ("Case3_Customer_08", "2022_5", 0.0, 39.0),
    ("Extra_Customer_06", "2021_8", 40.0, 20.0),
    ("Extra_Customer_06", "2021_9", 0.0, 20.0),
]


def _to_row_lookup(result: dict) -> dict[int, list[dict]]:
    lookup: dict[int, list[dict]] = {}
    for diff in result["diffs"]:
        lookup.setdefault(int(diff["temp_row_id"]), []).append(diff)
    return lookup


def _assert_has_diff(
    row_lookup: dict[int, list[dict]],
    row_idx: int,
    column_id: str,
    *,
    expected_current: float,
    expected_suggested: float,
) -> None:
    row_diffs = row_lookup.get(row_idx, [])
    matched = [
        d
        for d in row_diffs
        if d["column_id"] == column_id
        and float(d["current_val"]) == expected_current
        and float(d["suggested_val"]) == expected_suggested
    ]
    assert matched, (
        f"Missing diff for row={row_idx}, column={column_id}, "
        f"current={expected_current}, suggested={expected_suggested}. "
        f"Found={row_diffs}"
    )


@pytest.fixture(scope="module")
def pipeline_result():
    root = Path(__file__).resolve().parents[1]
    csv_path = root / "micahcb-keye-takehome-2026-test.csv"
    assert csv_path.exists(), f"Missing csv fixture at {csv_path}"

    source_df = pd.read_csv(csv_path)
    parquet_bytes = source_df.to_parquet(index=False)

    result = run_cleaning_pipeline(parquet_bytes, "test-file")
    assert isinstance(result, dict)
    assert "diff_rows" in result
    assert "diffs" in result

    row_lookup = _to_row_lookup(result)
    return source_df, result, row_lookup


@pytest.fixture(scope="module")
def customer_to_row_idx(pipeline_result):
    source_df, _, row_lookup = pipeline_result
    del row_lookup
    return {str(c): int(i) for i, c in enumerate(source_df["customer"])}


@pytest.mark.parametrize(
    "customer,column_id,expected_current,expected_suggested",
    CASE_1_CHECKS,
    ids=[c for c, _, _, _ in CASE_1_CHECKS],
)
def test_case_1_positive_then_same_negative_check(
    pipeline_result,
    customer_to_row_idx,
    customer,
    column_id,
    expected_current,
    expected_suggested,
):
    _, _, row_lookup = pipeline_result
    _assert_has_diff(
        row_lookup,
        customer_to_row_idx[customer],
        column_id,
        expected_current=expected_current,
        expected_suggested=expected_suggested,
    )


@pytest.mark.parametrize(
    "customer,column_id,expected_current,expected_suggested",
    CASE_2_CHECKS,
    ids=[c for c, _, _, _ in CASE_2_CHECKS],
)
def test_case_2_solo_negative_check(
    pipeline_result,
    customer_to_row_idx,
    customer,
    column_id,
    expected_current,
    expected_suggested,
):
    _, _, row_lookup = pipeline_result
    _assert_has_diff(
        row_lookup,
        customer_to_row_idx[customer],
        column_id,
        expected_current=expected_current,
        expected_suggested=expected_suggested,
    )


@pytest.mark.parametrize(
    "customer,column_id,expected_current,expected_suggested",
    CASE_3_CHECKS,
    ids=[c for c, _, _, _ in CASE_3_CHECKS],
)
def test_case_3_positive_then_zero_check(
    pipeline_result,
    customer_to_row_idx,
    customer,
    column_id,
    expected_current,
    expected_suggested,
):
    _, _, row_lookup = pipeline_result
    _assert_has_diff(
        row_lookup,
        customer_to_row_idx[customer],
        column_id,
        expected_current=expected_current,
        expected_suggested=expected_suggested,
    )


def test_pipeline_metadata_consistency(pipeline_result):
    _, result, _ = pipeline_result

    # Sanity checks that pipeline metadata is internally consistent.
    diff_row_ids = {int(d["temp_row_id"]) for d in result["diffs"]}
    returned_row_ids = {int(r["temp_id"]) for r in result["diff_rows"]}
    assert returned_row_ids == diff_row_ids
    assert result["row_count"] == len(result["diff_rows"])
    assert result["cell_count"] == len(result["diffs"])


