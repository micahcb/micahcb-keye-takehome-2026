export function titleCaseStatus(status: string): string {
  if (!status) return "Suggested"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "—"
    const abs = Math.abs(value)
    if (abs >= 1e7 || (abs > 0 && abs < 1e-4)) return value.toExponential(2)
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
  if (value.length === 0) return "—"
  return value
}
