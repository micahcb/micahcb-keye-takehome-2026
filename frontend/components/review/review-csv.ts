import { formatCell } from "./review-format"
import type { RowBundle } from "./types"

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildReviewGridCsv(rows: RowBundle[], columnOrder: string[]): string {
  const header = ["Row", "Status", ...columnOrder]
  const lines: string[][] = [header]
  for (const bundle of rows) {
    const statusLower = bundle.row.status.toLowerCase()
    const accepted = statusLower === "accepted"
    const diffByCol = Object.fromEntries(bundle.diffs.map((d) => [d.column_id, d]))
    const line: string[] = [String(bundle.row.source_row_idx), bundle.row.status]
    for (const col of columnOrder) {
      const d = diffByCol[col]
      let raw: string | number | null | undefined
      if (d) {
        raw = accepted ? (d.suggested_val ?? null) : (d.current_val ?? null)
      } else {
        raw = bundle.fullRow?.[col]
      }
      line.push(formatCell(raw))
    }
    lines.push(line)
  }
  return lines.map((row) => row.map((cell) => escapeCsvField(cell)).join(",")).join("\n")
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF", content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
