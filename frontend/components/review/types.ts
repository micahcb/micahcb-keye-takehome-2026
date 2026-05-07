export type DiffCell = {
  id: string
  column_id: string
  suggested_val: number | null
  current_val: number | null
}

export type DiffRow = {
  id: string
  source_row_idx: number
  status: string
}

export type RowBundle = {
  row: DiffRow
  diffs: DiffCell[]
  fullRow?: Record<string, string | number | null>
}

export type ReviewWorkbenchProps = {
  fileId: string
  summary: {
    rowCount: string
    cellCount: string
    rowsAdded: string
    diffsAdded: string
  }
  fullColumns: string[]
  initialRows: RowBundle[]
}
