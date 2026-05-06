import { getPostgresPool } from "@/lib/postgres"
import { FileActionButtons, RowActionButtons } from "@/components/review-actions"

type ReviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "0"
  return value ?? "0"
}

function titleCaseStatus(status: string): string {
  if (!status) return "Suggested"
  return status.charAt(0).toUpperCase() + status.slice(1)
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

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {}
  const fileId = getQueryValue(params.fileId)
  const rowCount = getQueryValue(params.rows)
  const cellCount = getQueryValue(params.cells)
  const rowsAdded = getQueryValue(params.rowsAdded)
  const diffsAdded = getQueryValue(params.diffsAdded)
  let rowsWithDiffs: Array<{ row: DiffRow; diffs: DiffCell[] }> = []

  if (fileId) {
    const postgresPool = getPostgresPool()
    const rowResult = await postgresPool.query<DiffRow>(
      `
        SELECT id, source_row_idx, status
        FROM diff_rows
        WHERE file_id = $1
        ORDER BY source_row_idx ASC
        LIMIT 25
      `,
      [fileId],
    )

    if (rowResult.rows.length > 0) {
      const rowIds = rowResult.rows.map((row) => row.id)
      const diffResult = await postgresPool.query<DiffCell & { row_id: string }>(
        `
          SELECT id, row_id, column_id, suggested_val, current_val
          FROM diffs
          WHERE row_id = ANY($1::uuid[])
          ORDER BY row_id ASC, column_id ASC
        `,
        [rowIds],
      )

      const groupedDiffs = new Map<string, DiffCell[]>()
      for (const diff of diffResult.rows) {
        const existing = groupedDiffs.get(diff.row_id) ?? []
        existing.push({
          id: diff.id,
          column_id: diff.column_id,
          suggested_val: diff.suggested_val,
          current_val: diff.current_val,
        })
        groupedDiffs.set(diff.row_id, existing)
      }

      rowsWithDiffs = rowResult.rows.map((row) => ({
        row,
        diffs: groupedDiffs.get(row.id) ?? [],
      }))
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-[#0a1628]">Review</h1>
      <p className="mt-3 text-sm text-[#384865]">
        Cleaning finished. Suggested diffs were generated and stored.
      </p>
      <div className="mt-6 space-y-2 rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-6 text-sm text-[#0a1628]">
        <p>Rows with changes: {rowCount}</p>
        <p>Total cell changes: {cellCount}</p>
        <p>Rows inserted into diff_rows: {rowsAdded}</p>
        <p>Rows inserted into diffs: {diffsAdded}</p>
      </div>

      <div className="mt-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#0a1628]">Suggested diffs (first 25 rows)</h2>
        {fileId && <FileActionButtons fileId={fileId} />}
        {rowsWithDiffs.length === 0 ? (
          <p className="text-sm text-[#384865]">No suggested diffs were found for this file.</p>
        ) : (
          rowsWithDiffs.map(({ row, diffs }) => (
            <div key={row.id} className="rounded-none border border-[#d6cfc3] bg-[#fffbf5] p-4">
              <p className="text-sm font-medium text-[#0a1628]">
                Source row {row.source_row_idx} - {titleCaseStatus(row.status)}
              </p>
              <div className="mt-2 space-y-1 text-xs text-[#384865]">
                {diffs.map((diff) => (
                  <p key={diff.id}>
                    {diff.column_id}: {String(diff.current_val)} {"->"}{" "}
                    {String(diff.suggested_val)}
                  </p>
                ))}
              </div>
              {fileId && <RowActionButtons fileId={fileId} rowId={row.id} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}