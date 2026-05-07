import { ReviewWorkbench } from "@/components/review/review-workbench"
import type { DiffCell, DiffRow, RowBundle } from "@/components/review/types"
import { getParquetRowsForReview } from "@/lib/review-parquet"

type ReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getQueryValue(value: string | string[] | undefined, fallback = "0"): string {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_FILE_CHANGE_API_BASE_URL ?? "http://localhost:8000"

/** Avoid tearing down the RSC stream on heavy work (parquet) or flaky deps — Railway/proxies show ERR_CONNECTION_RESET. */
export const maxDuration = 120

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {}
  const fileId = getQueryValue(params.fileId, "")
  const rowCount = getQueryValue(params.rows)
  const cellCount = getQueryValue(params.cells)
  const rowsAdded = getQueryValue(params.rowsAdded)
  const diffsAdded = getQueryValue(params.diffsAdded)
  const path = getQueryValue(params.path, "")
  const bucket = getQueryValue(params.bucket, "")
  let rowsWithDiffs: RowBundle[] = []
  let fullColumns: string[] = []

  if (fileId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/review/file-data?fileId=${encodeURIComponent(fileId)}&limit=10000`,
        { cache: "no-store", signal: AbortSignal.timeout(30_000) },
      )
      if (response.ok) {
        const data = (await response.json()) as {
          rows?: Array<{ row: DiffRow; diffs: DiffCell[] }>
        }
        rowsWithDiffs = data.rows ?? []
      }
    } catch (err) {
      console.error("[review] file-data fetch failed:", err)
    }
  }

  if (fileId && rowsWithDiffs.length > 0) {
    try {
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
    } catch (err) {
      console.error("[review] parquet hydrate failed:", err)
    }
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
