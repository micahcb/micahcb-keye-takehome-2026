import { ReviewWorkbench } from "@/components/review/review-workbench"
import { getParquetRowsForReview } from "@/lib/review-parquet"

type ReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getQueryValue(value: string | string[] | undefined, fallback = "0"): string {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

type DiffCell = {
  id: string
  column_id: string
  suggested_val: number | null
  current_val: number | null
}

type DiffRow = {
  id: string
  source_row_idx: number
  status: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {}
  const fileId = getQueryValue(params.fileId, "")
  const rowCount = getQueryValue(params.rows)
  const cellCount = getQueryValue(params.cells)
  const rowsAdded = getQueryValue(params.rowsAdded)
  const diffsAdded = getQueryValue(params.diffsAdded)
  const path = getQueryValue(params.path, "")
  const bucket = getQueryValue(params.bucket, "")
  let rowsWithDiffs: Array<{
    row: DiffRow
    diffs: DiffCell[]
    fullRow?: Record<string, string | number | null>
  }> = []
  let fullColumns: string[] = []

  if (fileId) {
    const response = await fetch(
      `${API_BASE_URL}/review/file-data?fileId=${encodeURIComponent(fileId)}&limit=100`,
      { cache: "no-store" },
    )
    if (response.ok) {
      const data = (await response.json()) as {
        rows?: Array<{ row: DiffRow; diffs: DiffCell[] }>
      }
      rowsWithDiffs = data.rows ?? []
    }
  }

  if (fileId && rowsWithDiffs.length > 0) {
    const parquetData = await getParquetRowsForReview(
      fileId,
      rowsWithDiffs.map((bundle) => bundle.row.source_row_idx),
      { path, bucket },
    )
    fullColumns = parquetData.columns
    rowsWithDiffs = rowsWithDiffs.map((bundle) => ({
      ...bundle,
      fullRow: parquetData.rowsByIndex[bundle.row.source_row_idx] ?? {},
    }))
  }

  return (
    <ReviewWorkbench
      fileId={fileId}
      summary={{
        rowCount,
        cellCount,
        rowsAdded,
        diffsAdded,
      }}
      fullColumns={fullColumns}
      initialRows={rowsWithDiffs}
    />
  )
}
