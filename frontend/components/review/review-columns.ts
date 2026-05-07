import type { RowBundle } from "./types"

function columnSortKey(name: string): string | number[] {
  const parts = name.split("_")
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) {
    return parts.map((p) => Number.parseInt(p, 10))
  }
  return name
}

export function uniqSortedColumns(rows: RowBundle[]): string[] {
  const set = new Set<string>()
  for (const bundle of rows) {
    for (const d of bundle.diffs) set.add(d.column_id)
  }
  return [...set].sort((a, b) => {
    const ka = columnSortKey(a)
    const kb = columnSortKey(b)
    if (Array.isArray(ka) && Array.isArray(kb)) {
      for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const da = ka[i] ?? 0
        const db = kb[i] ?? 0
        if (da !== db) return da - db
      }
      return 0
    }
    return String(ka).localeCompare(String(kb))
  })
}
